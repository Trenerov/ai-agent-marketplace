import { networks } from "@btc-vision/bitcoin";
import { createRpcProvider } from "./provider-helpers.mjs";
import { getNetworkName, loadDeploymentContext } from "./deployment-helpers.mjs";

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

async function broadcastSignedPackage(provider, signedPackage) {
  const receipt = {
    contractId: signedPackage.contractId,
    method: signedPackage.method,
    interactionTransactionId: "",
  };

  if (signedPackage.fundingTransactionRaw) {
    const funding = await provider.sendRawTransaction(signedPackage.fundingTransactionRaw, false);

    if (!funding.success || !funding.result) {
      throw new Error(
        `Funding broadcast failed for ${signedPackage.contractId}.${signedPackage.method}: ${funding.error || "unknown error"}`
      );
    }

    receipt.fundingTransactionId = funding.result;
  }

  const interaction = await provider.sendRawTransaction(signedPackage.interactionTransactionRaw, false);

  if (!interaction.success || !interaction.result) {
    throw new Error(
      `Interaction broadcast failed for ${signedPackage.contractId}.${signedPackage.method}: ${interaction.error || "unknown error"}`
    );
  }

  receipt.interactionTransactionId = interaction.result;
  return receipt;
}

async function main() {
  const raw = await readStdin();
  const payload = JSON.parse(raw);

  if (!Array.isArray(payload?.packages) || payload.packages.length === 0) {
    throw new Error("No signed packages provided.");
  }

  const context = await loadDeploymentContext();
  const { rpcUrl } = assertRuntimeConfig(context.config);
  const network = networks[getNetworkName(context.config?.network || process.env.OPNET_NETWORK || "opnetTestnet")];
  const provider = createRpcProvider({ url: rpcUrl, network });
  const receipts = [];

  for (const signedPackage of payload.packages) {
    receipts.push(await broadcastSignedPackage(provider, signedPackage));
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
