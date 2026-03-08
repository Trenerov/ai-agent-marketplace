import { promises as fs } from "node:fs";
import path from "node:path";

type ConfigureStep = {
  method: string;
  dependsOn: string;
};

type ManifestContractEntry = {
  artifact: string;
  abi: string;
  configure: ConfigureStep[];
};

type ContractManifest = {
  contracts: Record<string, ManifestContractEntry>;
};

type DeploymentState = {
  network?: string;
  rpcUrl?: string;
  updatedAt?: string;
  contracts?: Record<
    string,
    {
      address?: string;
      fundingTxId?: string;
      revealTxId?: string;
      configured?: Array<{
        method: string;
        txId?: string;
        dependsOn?: string;
      }>;
    }
  >;
};

export type ContractStatusEntry = {
  id: string;
  artifactPath: string;
  abiPath: string;
  artifactReady: boolean;
  abiReady: boolean;
  deployedAddress: string | null;
  fundingTxId: string | null;
  revealTxId: string | null;
  configure: Array<
    ConfigureStep & {
      dependencyAddress: string | null;
      satisfied: boolean;
      txId: string | null;
    }
  >;
  abiMethods: string[];
  readyForFrontend: boolean;
};

export type ContractStatusPayload = {
  network: string;
  deploymentConfigured: boolean;
  rpcUrl: string | null;
  updatedAt: string | null;
  contracts: ContractStatusEntry[];
};

const CONTRACT_ENV_MAP: Record<string, string> = {
  agentNft: "OPNET_AGENT_NFT_ADDRESS",
  agentRegistry: "OPNET_AGENT_REGISTRY_ADDRESS",
  usagePayment: "OPNET_USAGE_PAYMENT_ADDRESS",
  marketplace: "OPNET_MARKETPLACE_ADDRESS",
};

function resolveContractPath(relativePath: string) {
  return path.join(process.cwd(), "contracts", "opnet", relativePath);
}

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readManifest() {
  const manifestPath = resolveContractPath(path.join("deployment", "manifest.json"));
  const raw = await fs.readFile(manifestPath, "utf8");

  return JSON.parse(raw) as ContractManifest;
}

async function readDeploymentState() {
  const statePath = resolveContractPath(path.join("deployment", "state.json"));

  if (!(await fileExists(statePath))) {
    return null;
  }

  const raw = await fs.readFile(statePath, "utf8");
  return JSON.parse(raw) as DeploymentState;
}

async function readAbiMethodNames(abiPath: string) {
  if (!(await fileExists(abiPath))) {
    return [];
  }

  const raw = await fs.readFile(abiPath, "utf8");
  const abi = JSON.parse(raw) as Array<{ name?: string }>;

  return abi
    .map((entry) => entry.name)
    .filter((name): name is string => typeof name === "string");
}

function getDeploymentAddress(contractId: string) {
  const variableName = CONTRACT_ENV_MAP[contractId];

  if (!variableName) {
    return null;
  }

  const value = process.env[variableName];
  return value && value.trim() !== "" ? value.trim() : null;
}

export async function getContractStatus() {
  const [manifest, deploymentState] = await Promise.all([readManifest(), readDeploymentState()]);
  const deployedAddresses = Object.keys(manifest.contracts).reduce<Record<string, string | null>>(
    (acc, contractId) => {
      acc[contractId] =
        deploymentState?.contracts?.[contractId]?.address?.trim() || getDeploymentAddress(contractId);
      return acc;
    },
    {}
  );

  const contracts = await Promise.all(
    Object.entries(manifest.contracts).map(async ([contractId, entry]) => {
      const artifactPath = resolveContractPath(entry.artifact);
      const abiPath = resolveContractPath(entry.abi);
      const [artifactReady, abiReady, abiMethods] = await Promise.all([
        fileExists(artifactPath),
        fileExists(abiPath),
        readAbiMethodNames(abiPath),
      ]);

      const configure = entry.configure.map((step) => {
        const dependencyAddress = deployedAddresses[step.dependsOn] ?? null;
        const txId =
          deploymentState?.contracts?.[contractId]?.configured?.find(
            (configuredStep) => configuredStep.method === step.method
          )?.txId ?? null;
        return {
          ...step,
          dependencyAddress,
          satisfied: dependencyAddress !== null,
          txId,
        };
      });

      const deployedAddress = deployedAddresses[contractId] ?? null;
      const fundingTxId = deploymentState?.contracts?.[contractId]?.fundingTxId?.trim() ?? null;
      const revealTxId = deploymentState?.contracts?.[contractId]?.revealTxId?.trim() ?? null;

      return {
        id: contractId,
        artifactPath: entry.artifact,
        abiPath: entry.abi,
        artifactReady,
        abiReady,
        deployedAddress,
        fundingTxId,
        revealTxId,
        configure,
        abiMethods,
        readyForFrontend:
          artifactReady &&
          abiReady &&
          deployedAddress !== null &&
          configure.every((step) => step.satisfied),
      } satisfies ContractStatusEntry;
    })
  );

  return {
    network:
      deploymentState?.network ||
      process.env.NEXT_PUBLIC_OPNET_NETWORK ||
      process.env.OPNET_NETWORK ||
      "opnet-testnet",
    deploymentConfigured: contracts.every((contract) => contract.deployedAddress !== null),
    rpcUrl: deploymentState?.rpcUrl ?? null,
    updatedAt: deploymentState?.updatedAt ?? null,
    contracts,
  } satisfies ContractStatusPayload;
}
