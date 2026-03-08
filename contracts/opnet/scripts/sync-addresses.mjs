import fs from "node:fs/promises";
import path from "node:path";
import {
  appRoot,
  buildPlan,
  loadDeploymentContext,
} from "./deployment-helpers.mjs";

function getAddress(plan, contractId) {
  return plan.contracts.find((entry) => entry.id === contractId)?.deployedAddress || "";
}

async function main() {
  const context = await loadDeploymentContext();
  const plan = buildPlan(context);
  const envFilePath = path.join(appRoot, ".env.contracts.local");
  const lines = [
    `NEXT_PUBLIC_OPNET_NETWORK=${plan.network}`,
    `OPNET_NETWORK=${plan.network}`,
    `OPNET_AGENT_NFT_ADDRESS=${getAddress(plan, "agentNft")}`,
    `OPNET_AGENT_REGISTRY_ADDRESS=${getAddress(plan, "agentRegistry")}`,
    `OPNET_USAGE_PAYMENT_ADDRESS=${getAddress(plan, "usagePayment")}`,
    `OPNET_MARKETPLACE_ADDRESS=${getAddress(plan, "marketplace")}`,
    "",
  ];

  await fs.writeFile(envFilePath, lines.join("\n"), "utf8");
  console.log(`Wrote ${envFilePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
