import fs from "node:fs/promises";
import path from "node:path";
import { buildPlan, deploymentDir, loadDeploymentContext } from "./deployment-helpers.mjs";

async function main() {
  const context = await loadDeploymentContext();
  const plan = buildPlan(context);
  const targetPath = path.join(deploymentDir, "plan.json");

  await fs.writeFile(targetPath, JSON.stringify(plan, null, 2), "utf8");

  console.log(`Deployment plan written to ${targetPath}`);
  console.log(`Network: ${plan.network}`);

  for (const contract of plan.contracts) {
    console.log(
      `${contract.id}: ${contract.needsDeployment ? "deploy" : "configured address present"}`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
