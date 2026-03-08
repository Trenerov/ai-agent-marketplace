import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export const workspaceRoot = path.resolve(import.meta.dirname, "..");
export const deploymentDir = path.join(workspaceRoot, "deployment");
export const manifestPath = path.join(deploymentDir, "manifest.json");
export const configPath = path.join(deploymentDir, "config.json");
export const statePath = path.join(deploymentDir, "state.json");
export const appRoot = path.resolve(workspaceRoot, "..", "..");

function applyEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) {
    return;
  }

  const raw = fsSync.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

applyEnvFile(path.join(appRoot, ".env.local"));
applyEnvFile(path.join(appRoot, ".env.contracts.local"));

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function maybeReadJson(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function envAddress(contractId) {
  const mapping = {
    agentNft: process.env.OPNET_AGENT_NFT_ADDRESS,
    agentRegistry: process.env.OPNET_AGENT_REGISTRY_ADDRESS,
    usagePayment: process.env.OPNET_USAGE_PAYMENT_ADDRESS,
    marketplace: process.env.OPNET_MARKETPLACE_ADDRESS,
  };

  return mapping[contractId]?.trim() || null;
}

export function normalizeStateContract(entry = {}) {
  return {
    address: entry.address || "",
    publicKey: entry.publicKey || "",
    fundingTxId: entry.fundingTxId || "",
    revealTxId: entry.revealTxId || "",
    configured: Array.isArray(entry.configured) ? entry.configured : [],
  };
}

export function getNetworkName(rawNetwork) {
  const supported = {
    bitcoin: "bitcoin",
    bitcoinTestnet: "bitcoinTestnet",
    regtest: "regtest",
    opnetTestnet: "opnetTestnet",
    opnetRegtest: "opnetRegtest",
  };

  if (!supported[rawNetwork]) {
    throw new Error(`Unsupported network "${rawNetwork}".`);
  }

  return supported[rawNetwork];
}

export async function loadDeploymentContext() {
  const [manifest, config, state] = await Promise.all([
    readJson(manifestPath),
    maybeReadJson(configPath),
    maybeReadJson(statePath),
  ]);

  return {
    manifest,
    config,
    state,
  };
}

export function buildPlan({ manifest, state, config }) {
  const priorContracts = state?.contracts || {};
  const contracts = Object.entries(manifest.contracts).map(([contractId, entry]) => {
    const stateEntry = normalizeStateContract(priorContracts[contractId]);
    const deployedAddress = stateEntry.address || envAddress(contractId) || "";

    return {
      id: contractId,
      artifact: entry.artifact,
      abi: entry.abi,
      deployedAddress,
      needsDeployment: deployedAddress === "",
      configure: entry.configure.map((step) => {
        const dependency = normalizeStateContract(priorContracts[step.dependsOn]);
        const dependencyAddress = dependency.address || envAddress(step.dependsOn) || "";
        const alreadyConfigured = stateEntry.configured.some(
          (configuredStep) => configuredStep.method === step.method && configuredStep.txId
        );

        return {
          ...step,
          dependencyAddress,
          ready: dependencyAddress !== "",
          alreadyConfigured,
        };
      }),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    network: config?.network || process.env.OPNET_NETWORK || "opnetTestnet",
    rpcUrl: config?.rpcUrl || process.env.OPNET_RPC_URL || "",
    contracts,
  };
}

export async function writeState(nextState) {
  await fs.writeFile(statePath, JSON.stringify(nextState, null, 2), "utf8");
}

export function normalizeAbi(abi) {
  const entries = Array.isArray(abi) ? abi : [...(abi?.functions || []), ...(abi?.events || [])];

  return entries.map((entry) => ({
    ...entry,
    type: typeof entry?.type === "string" ? entry.type.toLowerCase() : entry?.type,
  }));
}
