import fs from "node:fs/promises";
import path from "node:path";
import { networks } from "@btc-vision/bitcoin";
import { Address } from "@btc-vision/transaction";
import { getContract } from "opnet";
import { getNetworkName, loadDeploymentContext, normalizeAbi, workspaceRoot } from "./deployment-helpers.mjs";
import { createRpcProvider } from "./provider-helpers.mjs";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function assertRuntimeConfig(config) {
  const rpcUrl = config?.rpcUrl || process.env.OPNET_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing RPC URL. Set deployment/config.json rpcUrl or OPNET_RPC_URL.");
  }

  return { rpcUrl };
}

function bigintFrom(value, fallback) {
  return BigInt(value ?? fallback);
}

function getAbiFile(contractId) {
  switch (contractId) {
    case "agentNft":
      return "AgentNFT.abi.json";
    case "agentRegistry":
      return "AgentRegistry.abi.json";
    case "usagePayment":
      return "UsagePayment.abi.json";
    case "marketplace":
      return "Marketplace.abi.json";
    default:
      throw new Error(`Unknown contractId ${contractId}`);
  }
}

function convertArgument(arg) {
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

function getRequiredSats(config, valueSats) {
  const maxSpend = bigintFrom(config.maximumAllowedSatToSpend, "50000");
  return maxSpend + BigInt(valueSats ?? 0);
}

async function prepareIntentPackage({ provider, network, fromAddress, config, intent }) {
  if (
    intent.args.some(
      (arg) => typeof arg.value === "string" && arg.value === "resolve-from-mint-event"
    )
  ) {
    return {
      blocked: {
        contractId: intent.contractId,
        method: intent.method,
        reason: "This step depends on a minted tokenId and cannot be prepared before the mint receipt exists.",
      },
    };
  }

  const abiPath = path.join(workspaceRoot, "abis", getAbiFile(intent.contractId));
  const abi = normalizeAbi(JSON.parse(await fs.readFile(abiPath, "utf8")));
  const contract = getContract(
    Address.fromString(intent.address),
    abi,
    provider,
    network,
    Address.fromString(fromAddress)
  );

  const args = intent.args.map(convertArgument);
  const simulation = await contract[intent.method](...args);

  if (simulation?.revert) {
    throw new Error(`Simulation reverted for ${intent.contractId}.${intent.method}: ${simulation.revert}`);
  }

  const requiredSats = getRequiredSats(config, intent.valueSats);
  const offlineBuffer = await simulation.toOfflineBuffer(fromAddress, requiredSats);

  return {
    package: {
      contractId: intent.contractId,
      method: intent.method,
      description: intent.description,
      address: intent.address,
      valueSats: Number(intent.valueSats ?? 0),
      requiredSats: Number(requiredSats),
      offlineBufferBase64: Buffer.from(offlineBuffer).toString("base64"),
      filename: `${intent.contractId}-${intent.method}-offline.bin`,
    },
  };
}

async function main() {
  const raw = await readStdin();
  const payload = JSON.parse(raw);

  if (!payload?.intents || !Array.isArray(payload.intents) || payload.intents.length === 0) {
    throw new Error("No intents provided.");
  }

  const fromAddress = payload?.signer?.address || payload?.address;
  if (!fromAddress) {
    throw new Error("Missing signer address for offline signing preparation.");
  }

  const context = await loadDeploymentContext();
  const { rpcUrl } = assertRuntimeConfig(context.config);
  const network = networks[getNetworkName(context.config?.network || process.env.OPNET_NETWORK || "opnetTestnet")];
  const provider = createRpcProvider({ url: rpcUrl, network });
  const packages = [];
  const blocked = [];

  for (const intent of payload.intents) {
    const result = await prepareIntentPackage({
      provider,
      network,
      fromAddress,
      config: context.config || {},
      intent,
    });

    if (result.blocked) {
      blocked.push(result.blocked);
      continue;
    }

    packages.push(result.package);
  }

  process.stdout.write(JSON.stringify({ ok: true, packages, blocked }, null, 2));
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        packages: [],
        blocked: [],
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
