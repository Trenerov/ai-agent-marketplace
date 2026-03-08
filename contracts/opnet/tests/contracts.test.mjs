import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function getFunctionNames(abi) {
  return new Set((abi.functions ?? []).map((fn) => fn.name));
}

function getEventNames(abi) {
  return new Set((abi.events ?? []).map((event) => event.name));
}

function runCheck(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runCheck("build artifacts exist for all contracts", () => {
  const artifacts = [
    "build/AgentNFT.wasm",
    "build/AgentRegistry.wasm",
    "build/UsagePayment.wasm",
    "build/Marketplace.wasm",
  ];

  for (const artifact of artifacts) {
    assert.equal(fs.existsSync(path.join(rootDir, artifact)), true, `${artifact} is missing`);
  }
});

runCheck("AgentNFT ABI exposes agent-specific methods and events", () => {
  const abi = readJson("abis/AgentNFT.abi.json");
  const functions = getFunctionNames(abi);
  const events = getEventNames(abi);

  for (const fn of [
    "mint",
    "updatePrice",
    "toggleActive",
    "updateMetadata",
    "getAgent",
    "priceOf",
    "promptHashOf",
    "isActiveAgent",
    "recordUsage",
  ]) {
    assert.equal(functions.has(fn), true, `AgentNFT ABI missing ${fn}`);
  }

  for (const event of [
    "AgentMinted",
    "AgentPriceUpdated",
    "AgentToggled",
    "AgentMetadataUpdated",
  ]) {
    assert.equal(events.has(event), true, `AgentNFT ABI missing ${event}`);
  }
});

runCheck("OP721 ABI exposes inherited NFT transfer and ownership methods", () => {
  const abi = readJson("abis/OP721.abi.json");
  const functions = getFunctionNames(abi);

  for (const fn of [
    "ownerOf",
    "safeTransfer",
    "safeTransferFrom",
    "approve",
    "getApproved",
    "tokenURI",
  ]) {
    assert.equal(functions.has(fn), true, `OP721 ABI missing ${fn}`);
  }
});

runCheck("Marketplace ABI exposes escrow wiring and listing reads", () => {
  const abi = readJson("abis/Marketplace.abi.json");
  const functions = getFunctionNames(abi);

  for (const fn of [
    "configureAgentContract",
    "list",
    "buy",
    "cancelListing",
    "totalListings",
    "totalActiveListings",
    "listingForAgent",
    "getListing",
  ]) {
    assert.equal(functions.has(fn), true, `Marketplace ABI missing ${fn}`);
  }
});

runCheck("UsagePayment ABI exposes pricing and registry wiring", () => {
  const abi = readJson("abis/UsagePayment.abi.json");
  const functions = getFunctionNames(abi);

  for (const fn of [
    "configureAgentContract",
    "configureRegistryContract",
    "pay",
    "claimEarnings",
    "earningsOf",
    "totalPaidForAgent",
    "totalProtocolRevenue",
    "totalReferralRevenue",
  ]) {
    assert.equal(functions.has(fn), true, `UsagePayment ABI missing ${fn}`);
  }
});

runCheck("deployment manifest is aligned with contract ABIs", () => {
  const manifest = readJson("deployment/manifest.json");
  const contractEntries = Object.entries(manifest.contracts);

  assert.ok(contractEntries.length >= 4, "manifest must describe all contracts");

  for (const [, contractConfig] of contractEntries) {
    assert.equal(
      fs.existsSync(path.join(rootDir, contractConfig.artifact)),
      true,
      `artifact ${contractConfig.artifact} is missing`
    );

    const abi = readJson(contractConfig.abi);
    const functions = getFunctionNames(abi);

    for (const step of contractConfig.configure) {
      assert.equal(
        functions.has(step.method),
        true,
        `configure method ${step.method} missing in ${contractConfig.abi}`
      );
      assert.ok(
        manifest.contracts[step.dependsOn],
        `manifest dependency ${step.dependsOn} is missing`
      );
    }
  }
});

runCheck("deployment toolkit files exist", () => {
  for (const file of [
    "deployment/config.example.json",
    "deployment/state.example.json",
    "scripts/deployment-helpers.mjs",
    "scripts/deployment-plan.mjs",
    "scripts/deploy.mjs",
    "scripts/sync-addresses.mjs",
    "scripts/broadcast-intent.mjs",
    "scripts/broadcast-signed.mjs",
    "scripts/fetch-transaction-events.mjs",
    "scripts/prepare-intent.mjs",
    "scripts/verify-payment.mjs",
    "scripts/verify-intent-signature.mjs",
  ]) {
    assert.equal(fs.existsSync(path.join(rootDir, file)), true, `${file} is missing`);
  }
});

runCheck("generated deployment plan reflects manifest contracts", () => {
  const plan = readJson("deployment/plan.json");
  const manifest = readJson("deployment/manifest.json");

  assert.equal(plan.contracts.length, Object.keys(manifest.contracts).length);

  for (const entry of plan.contracts) {
    assert.ok(manifest.contracts[entry.id], `plan contains unknown contract ${entry.id}`);
    assert.equal(typeof entry.needsDeployment, "boolean");
    assert.ok(Array.isArray(entry.configure), `plan configure for ${entry.id} must be an array`);
  }
});

console.log("All contract checks passed.");
