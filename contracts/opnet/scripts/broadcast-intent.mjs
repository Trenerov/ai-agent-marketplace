import fs from "node:fs/promises";
import path from "node:path";
import { networks } from "@btc-vision/bitcoin";
import { Address, AddressTypes, MLDSASecurityLevel, Mnemonic } from "@btc-vision/transaction";
import { getContract } from "opnet";
import {
  getNetworkName,
  loadDeploymentContext,
  normalizeAbi,
  normalizeStateContract,
  statePath,
  workspaceRoot,
  writeState,
} from "./deployment-helpers.mjs";
import { createRpcProvider } from "./provider-helpers.mjs";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function findMintedTokenId({ provider, contract, transactionId }) {
  const receipt = await provider.getTransactionReceipt(transactionId);

  for (const events of Object.values(receipt.events || {})) {
    const decodedEvents = contract.decodeEvents(events);
    const mintedEvent = decodedEvents.find((event) => event.type === "AgentMinted");

    if (mintedEvent?.properties?.tokenId !== undefined) {
      return BigInt(mintedEvent.properties.tokenId);
    }
  }

  throw new Error(`Unable to resolve minted tokenId from transaction ${transactionId}.`);
}

function bigintFrom(value, fallback) {
  return BigInt(value ?? fallback);
}

function numberFrom(value, fallback) {
  return Number(value ?? fallback);
}

function assertRuntimeConfig(config) {
  const mnemonic = process.env.OPNET_MNEMONIC;
  const rpcUrl = config?.rpcUrl || process.env.OPNET_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing RPC URL. Set deployment/config.json rpcUrl or OPNET_RPC_URL.");
  }

  if (!mnemonic) {
    throw new Error("Missing OPNET_MNEMONIC for broadcaster.");
  }

  return { mnemonic, rpcUrl };
}

function convertArgument(arg, context) {
  if (typeof arg.value === "string" && arg.value === "resolve-from-mint-event") {
    if (context?.mintedTokenId === undefined) {
      throw new Error("Unresolved dynamic argument resolve-from-mint-event cannot be broadcast yet.");
    }

    return context.mintedTokenId;
  }

  switch (arg.type) {
    case "ADDRESS":
      return Address.fromString(String(arg.value));
    case "UINT8":
    case "UINT16":
    case "UINT32":
    case "UINT64":
    case "UINT128":
    case "UINT256":
      return BigInt(arg.value);
    case "STRING":
      return String(arg.value);
    default:
      return arg.value;
  }
}

async function sendIntent({ provider, wallet, network, config, intent, abi, resolutionContext }) {
  const contract = getContract(
    Address.fromString(intent.address),
    abi,
    provider,
    network,
    wallet.address
  );

  const args = intent.args.map((arg) => convertArgument(arg, resolutionContext));
  const simulation = await contract[intent.method](...args);

  if (simulation?.revert) {
    throw new Error(`Simulation reverted for ${intent.contractId}.${intent.method}: ${simulation.revert}`);
  }

  const receipt = await simulation.sendTransaction(
    {
      signer: wallet.keypair,
      mldsaSigner: wallet.mldsaKeypair,
      refundTo: wallet.p2tr,
      maximumAllowedSatToSpend: bigintFrom(config.maximumAllowedSatToSpend, "50000"),
      feeRate: numberFrom(config.feeRate, 10),
      network,
    },
    BigInt(intent.valueSats ?? 0)
  );

  const receiptData = {
    contractId: intent.contractId,
    method: intent.method,
    transactionId: receipt.transactionId || "",
    resolvedTokenId: undefined,
  };

  if (intent.method === "mint") {
    const mintedTokenId = await findMintedTokenId({
      provider,
      contract,
      transactionId: receiptData.transactionId,
    });

    resolutionContext.mintedTokenId = mintedTokenId;
    receiptData.resolvedTokenId = Number(mintedTokenId);
  }

  return receiptData;
}

async function persistConfigureState({ context, receipts }) {
  const nextState = {
    network: context.state?.network || context.config?.network || process.env.OPNET_NETWORK || "opnetTestnet",
    rpcUrl: context.state?.rpcUrl || context.config?.rpcUrl || process.env.OPNET_RPC_URL || "",
    updatedAt: new Date().toISOString(),
    contracts: context.state?.contracts || {},
  };

  for (const receipt of receipts) {
    const manifestEntry = context.manifest.contracts[receipt.contractId];
    if (!manifestEntry) {
      continue;
    }

    const stateEntry = normalizeStateContract(nextState.contracts[receipt.contractId]);
    for (const step of manifestEntry.configure) {
      if (step.method !== receipt.method) {
        continue;
      }

      const existing = stateEntry.configured.find((configured) => configured.method === step.method);
      if (existing) {
        existing.txId = receipt.transactionId;
        existing.dependsOn = step.dependsOn;
      } else {
        stateEntry.configured.push({
          method: step.method,
          txId: receipt.transactionId,
          dependsOn: step.dependsOn,
        });
      }
    }

    nextState.contracts[receipt.contractId] = stateEntry;
  }

  await writeState(nextState);
  await fs.writeFile(statePath, JSON.stringify(nextState, null, 2), "utf8");
}

async function main() {
  const raw = await readStdin();
  const payload = JSON.parse(raw);

  if (!payload?.intents || !Array.isArray(payload.intents) || payload.intents.length === 0) {
    throw new Error("No intents provided.");
  }

  const context = await loadDeploymentContext();
  const { mnemonic, rpcUrl } = assertRuntimeConfig(context.config);
  const network = networks[getNetworkName(context.config?.network || process.env.OPNET_NETWORK || "opnetTestnet")];
  const provider = createRpcProvider({ url: rpcUrl, network });
  const phrase = new Mnemonic(mnemonic, "", network, MLDSASecurityLevel.LEVEL2);
  const wallet = phrase.deriveOPWallet(AddressTypes.P2TR, context.config?.wallet?.accountIndex ?? 0);
  const receipts = [];
  const resolutionContext = {};

  for (const intent of payload.intents) {
    const abiPath = path.join(workspaceRoot, "abis", `${intent.contractId === "agentNft" ? "AgentNFT" : intent.contractId === "agentRegistry" ? "AgentRegistry" : intent.contractId === "usagePayment" ? "UsagePayment" : "Marketplace"}.abi.json`);
    const abi = normalizeAbi(JSON.parse(await fs.readFile(abiPath, "utf8")));
    const receipt = await sendIntent({
      provider,
      wallet,
      network,
      config: context.config || {},
      intent,
      abi,
      resolutionContext,
    });
    receipts.push(receipt);

  }

  await persistConfigureState({ context, receipts });
  process.stdout.write(JSON.stringify({ ok: true, receipts }, null, 2));
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        receipts: [],
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
