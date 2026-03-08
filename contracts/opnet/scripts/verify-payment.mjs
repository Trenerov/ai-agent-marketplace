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

function resolveUsagePaymentAddress(context) {
  return (
    context.state?.contracts?.usagePayment?.address ||
    envAddress("usagePayment") ||
    ""
  );
}

async function main() {
  const raw = await readStdin();
  const payload = JSON.parse(raw);
  const context = await loadDeploymentContext();
  const rpcUrl = context.config?.rpcUrl || process.env.OPNET_RPC_URL;
  const networkName = context.config?.network || process.env.OPNET_NETWORK || "opnetTestnet";
  const usagePaymentAddress = resolveUsagePaymentAddress(context);

  if (!rpcUrl) {
    throw new Error("Missing RPC URL for payment verification.");
  }

  if (!usagePaymentAddress) {
    throw new Error("UsagePayment contract address is missing.");
  }

  if (!payload?.paymentTxId || !payload?.agentId || !payload?.amount) {
    throw new Error("paymentTxId, agentId and amount are required.");
  }

  const network = networks[getNetworkName(networkName)];
  const provider = createRpcProvider({ url: rpcUrl, network });
  const abiPath = path.join(workspaceRoot, "abis", "UsagePayment.abi.json");
  const abi = JSON.parse(await fs.readFile(abiPath, "utf8"));
  const contract = getContract(Address.fromString(usagePaymentAddress), abi, provider, network);
  const receipt = await provider.getTransactionReceipt(payload.paymentTxId);

  if (receipt.revert) {
    throw new Error(`Payment transaction reverted: ${receipt.revert}`);
  }

  const contractEvents =
    receipt.events[usagePaymentAddress] ||
    receipt.events[usagePaymentAddress.toLowerCase()] ||
    [];
  const decoded = contract.decodeEvents(contractEvents);
  const paymentEvent = decoded.find((event) => event.type === "PaymentReceived");

  if (!paymentEvent) {
    throw new Error("PaymentReceived event not found in transaction receipt.");
  }

  const eventAgentId = BigInt(paymentEvent.properties.agentId);
  const eventAmount = BigInt(paymentEvent.properties.amount);
  const expectedAgentId = BigInt(payload.agentId);
  const expectedAmount = BigInt(payload.amount);

  if (eventAgentId !== expectedAgentId) {
    throw new Error(`Payment agent mismatch: expected ${expectedAgentId}, got ${eventAgentId}.`);
  }

  if (eventAmount < expectedAmount) {
    throw new Error(`Payment amount mismatch: expected at least ${expectedAmount}, got ${eventAmount}.`);
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        paymentTxId: payload.paymentTxId,
        agentId: eventAgentId.toString(),
        amount: eventAmount.toString(),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
