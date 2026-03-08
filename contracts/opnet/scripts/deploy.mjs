import fs from "node:fs/promises";
import path from "node:path";
import { networks } from "@btc-vision/bitcoin";
import {
  Address,
  AddressTypes,
  BinaryWriter,
  MLDSASecurityLevel,
  Mnemonic,
  TransactionFactory,
} from "@btc-vision/transaction";
import { getContract } from "opnet";
import {
  buildPlan,
  getNetworkName,
  loadDeploymentContext,
  normalizeAbi,
  normalizeStateContract,
  statePath,
  workspaceRoot,
  writeState,
} from "./deployment-helpers.mjs";
import { createRpcProvider } from "./provider-helpers.mjs";

const isDryRun = process.argv.includes("--dry-run");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bigintFrom(value, fallback) {
  return BigInt(value ?? fallback);
}

function numberFrom(value, fallback) {
  return Number(value ?? fallback);
}

function extractTransactionId(result) {
  if (!result) {
    return "";
  }

  if (typeof result === "string") {
    return result;
  }

  if (typeof result === "object") {
    return result.txid || result.transactionId || result.result || "";
  }

  return "";
}

function assertRuntimeConfig(config) {
  const mnemonic = process.env.OPNET_MNEMONIC;
  const rpcUrl = config?.rpcUrl || process.env.OPNET_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing RPC URL. Set deployment/config.json rpcUrl or OPNET_RPC_URL.");
  }

  if (!mnemonic) {
    throw new Error("Missing OPNET_MNEMONIC for deployment.");
  }

  return { mnemonic, rpcUrl };
}

async function deployContract({ provider, wallet, network, contractId, artifactPath, config }) {
  const bytecode = await fs.readFile(path.join(workspaceRoot, artifactPath));
  const utxos = await provider.utxoManager.getUTXOs({ address: wallet.p2tr });

  if (utxos.length === 0) {
    throw new Error(`No UTXOs available for deploying ${contractId}.`);
  }

  const challenge = await provider.getChallenge();
  const factory = new TransactionFactory();
  const deployment = await factory.signDeployment({
    from: wallet.p2tr,
    utxos,
    signer: wallet.keypair,
    mldsaSigner: wallet.mldsaKeypair,
    network,
    feeRate: numberFrom(config.feeRate, 10),
    priorityFee: bigintFrom(config.priorityFee, "0"),
    gasSatFee: bigintFrom(config.gasSatFee, "10000"),
    bytecode,
    calldata: new BinaryWriter().getBuffer(),
    challenge,
    linkMLDSAPublicKeyToAddress: true,
    revealMLDSAPublicKey: true,
  });

  const funding = await provider.sendRawTransaction(deployment.transaction[0]);
  const reveal = await provider.sendRawTransaction(deployment.transaction[1]);

  return {
    address: deployment.contractAddress,
    publicKey: deployment.contractPubKey,
    fundingTxId: extractTransactionId(funding),
    revealTxId: extractTransactionId(reveal),
    configured: [],
  };
}

async function waitForContractAvailability(provider, contractAddress, attempts = 12, delayMs = 5000) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const info = await provider.getPublicKeyInfo(contractAddress, true);

    if (info) {
      return info;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  throw new Error(`Address ${contractAddress} not found on the network.`);
}

async function resolveContractPublicKey(provider, stateEntry) {
  if (stateEntry.publicKey) {
    return stateEntry.publicKey;
  }

  if (!stateEntry.address) {
    throw new Error("Missing contract address.");
  }

  const info = await waitForContractAvailability(provider, stateEntry.address);
  const resolved = typeof info === "string" ? info : String(info);
  stateEntry.publicKey = resolved;
  return resolved;
}

async function configureContract({ provider, wallet, network, contractAddress, dependencyPublicKey, abi, method, config }) {
  await waitForContractAvailability(provider, contractAddress);
  const contract = getContract(
    contractAddress,
    abi,
    provider,
    network,
    wallet.address
  );
  const simulation = await contract[method](Address.fromString(dependencyPublicKey));
  const receipt = await simulation.sendTransaction({
    signer: wallet.keypair,
    mldsaSigner: wallet.mldsaKeypair,
    refundTo: wallet.p2tr,
    maximumAllowedSatToSpend: bigintFrom(config.maximumAllowedSatToSpend, "50000"),
    feeRate: numberFrom(config.feeRate, 10),
    network,
  });

  return receipt.transactionId || "";
}

async function main() {
  const context = await loadDeploymentContext();
  const plan = buildPlan(context);

  if (isDryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const { mnemonic, rpcUrl } = assertRuntimeConfig(context.config);
  const network = networks[getNetworkName(plan.network)];
  const provider = createRpcProvider({ url: rpcUrl, network });
  const phrase = new Mnemonic(mnemonic, "", network, MLDSASecurityLevel.LEVEL2);
  const wallet = phrase.deriveOPWallet(AddressTypes.P2TR, context.config?.wallet?.accountIndex ?? 0);
  const nextState = {
    network: plan.network,
    rpcUrl,
    updatedAt: new Date().toISOString(),
    contracts: {},
  };

  for (const contract of plan.contracts) {
    const existing = normalizeStateContract(context.state?.contracts?.[contract.id]);

    if (contract.deployedAddress) {
      nextState.contracts[contract.id] = {
        ...existing,
        address: contract.deployedAddress,
      };
      continue;
    }

    console.log(`Deploying ${contract.id}...`);
    nextState.contracts[contract.id] = await deployContract({
      provider,
      wallet,
      network,
      contractId: contract.id,
      artifactPath: context.manifest.contracts[contract.id].artifact,
      config: context.config || {},
    });
    await writeState(nextState);
  }

  for (const contract of plan.contracts) {
    const stateEntry = normalizeStateContract(nextState.contracts[contract.id]);
    const abiPath = path.join(workspaceRoot, context.manifest.contracts[contract.id].abi);
    const abi = normalizeAbi(JSON.parse(await fs.readFile(abiPath, "utf8")));

    for (const step of contract.configure) {
      const configuredAlready = stateEntry.configured.some(
        (configuredStep) => configuredStep.method === step.method && configuredStep.txId
      );
      const dependencyEntry = normalizeStateContract(nextState.contracts[step.dependsOn]);

      if (configuredAlready || !dependencyEntry.address) {
        continue;
      }

      await resolveContractPublicKey(provider, stateEntry);
      const dependencyPublicKey = await resolveContractPublicKey(provider, dependencyEntry);
      nextState.contracts[contract.id] = stateEntry;
      nextState.contracts[step.dependsOn] = dependencyEntry;

      console.log(`Configuring ${contract.id}.${step.method} -> ${step.dependsOn}`);
      const txId = await configureContract({
        provider,
        wallet,
        network,
        contractAddress: stateEntry.address,
        dependencyPublicKey,
        abi,
        method: step.method,
        config: context.config || {},
      });

      stateEntry.configured.push({
        method: step.method,
        txId,
        dependsOn: step.dependsOn,
      });
      nextState.contracts[contract.id] = stateEntry;
      await writeState(nextState);
    }
  }

  await fs.writeFile(statePath, JSON.stringify(nextState, null, 2), "utf8");
  console.log(`Deployment state written to ${statePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
