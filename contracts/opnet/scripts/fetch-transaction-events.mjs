import fs from "node:fs/promises";
import path from "node:path";
import { networks } from "@btc-vision/bitcoin";
import { Address } from "@btc-vision/transaction";
import { getContract } from "opnet";
import { envAddress, getNetworkName, loadDeploymentContext, workspaceRoot } from "./deployment-helpers.mjs";
import { createRpcProvider } from "./provider-helpers.mjs";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
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

function getContractAddress(context, contractId) {
  return context.state?.contracts?.[contractId]?.address || envAddress(contractId) || "";
}

async function decodeTransactionEvents(provider, network, context, contractId, transactionId) {
  const address = getContractAddress(context, contractId);
  if (!address) {
    throw new Error(`Missing deployed address for ${contractId}.`);
  }

  const abiPath = path.join(workspaceRoot, "abis", getAbiFile(contractId));
  const abi = JSON.parse(await fs.readFile(abiPath, "utf8"));
  const contract = getContract(Address.fromString(address), abi, provider, network);
  const receipt = await provider.getTransactionReceipt(transactionId);
  const rawEvents = receipt.events[address] || receipt.events[address.toLowerCase()] || [];
  const decodedEvents = contract.decodeEvents(rawEvents);

  return {
    contractId,
    transactionId,
    reverted: receipt.revert || null,
    events: decodedEvents.map((event) => ({
      type: event.type,
      properties: event.properties,
    })),
  };
}

async function main() {
  const raw = await readStdin();
  const payload = JSON.parse(raw);
  const context = await loadDeploymentContext();
  const rpcUrl = context.config?.rpcUrl || process.env.OPNET_RPC_URL;
  const networkName = context.config?.network || process.env.OPNET_NETWORK || "opnetTestnet";

  if (!rpcUrl) {
    throw new Error("Missing RPC URL for event sync.");
  }

  if (!Array.isArray(payload?.transactions) || payload.transactions.length === 0) {
    throw new Error("transactions array is required.");
  }

  const network = networks[getNetworkName(networkName)];
  const provider = createRpcProvider({ url: rpcUrl, network });
  const receipts = [];

  for (const transaction of payload.transactions) {
    receipts.push(
      await decodeTransactionEvents(
        provider,
        network,
        context,
        transaction.contractId,
        transaction.transactionId
      )
    );
  }

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
