import "server-only";

import { createHash } from "node:crypto";
import type { ContractActionEnvelope, ContractCallIntent } from "@/lib/contract-intent";
import { getContractStatus } from "@/lib/contracts";
import type { DataSourceMode } from "@/lib/data-source";
import { createContractWritePolicy } from "@/lib/runtime-policy";

export type ContractActionResult<T> =
  | {
      mode: "local";
      data: T;
    }
  | ContractActionEnvelope;

async function getReadyContracts() {
  const status = await getContractStatus();
  const contracts = Object.fromEntries(status.contracts.map((entry) => [entry.id, entry]));
  return { status, contracts };
}

export async function buildMintAction(input: {
  name: string;
  category: number;
  prompt: string;
  pricePerUse: number;
  royaltyBps: number;
  source: DataSourceMode;
}): Promise<ContractActionResult<null> | null> {
  const { contracts } = await getReadyContracts();
  const agentNft = contracts.agentNft;

  if (!agentNft?.readyForFrontend || !agentNft.deployedAddress) {
    return null;
  }

  const registry = contracts.agentRegistry;
  const promptHash = createHash("sha256").update(input.prompt).digest("hex");
  const metadataUri = `ipfs://${input.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
  const intents: ContractCallIntent[] = [
    {
      contractId: "agentNft",
      address: agentNft.deployedAddress,
      method: "mint",
      description: "Mint the agent NFT with prompt hash, metadata, pricing and royalty settings.",
      args: [
        { name: "promptHash", type: "STRING", value: `0x${promptHash}` },
        { name: "metadataURI", type: "STRING", value: metadataUri },
        { name: "pricePerUse", type: "UINT256", value: input.pricePerUse },
        { name: "category", type: "UINT8", value: input.category },
        { name: "royaltyBps", type: "UINT16", value: input.royaltyBps },
      ],
    },
  ];

  if (registry?.readyForFrontend && registry.deployedAddress) {
    intents.push({
      contractId: "agentRegistry",
      address: registry.deployedAddress,
      method: "register",
      description: "Register the freshly minted agent in the discovery registry after mint confirmation.",
      args: [{ name: "agentId", type: "UINT256", value: "resolve-from-mint-event" }],
    });
  }

  return {
    mode: "contract",
    message: "Contracts are configured. Mint should be sent on-chain instead of the local store.",
    intents,
    policy: createContractWritePolicy("mint", input.source),
  };
}

export async function buildListingAction(input: {
  agentId: number;
  price: number;
  source: DataSourceMode;
}): Promise<ContractActionResult<null> | null> {
  const { contracts } = await getReadyContracts();
  const marketplace = contracts.marketplace;

  if (!marketplace?.readyForFrontend || !marketplace.deployedAddress) {
    return null;
  }

  return {
    mode: "contract",
    message: "Marketplace contract is configured. Listing should be executed on-chain.",
    policy: createContractWritePolicy("list", input.source),
    intents: [
      {
        contractId: "marketplace",
        address: marketplace.deployedAddress,
        method: "list",
        description: "List the agent in the OP_NET marketplace escrow contract.",
        args: [
          { name: "agentId", type: "UINT256", value: input.agentId },
          { name: "price", type: "UINT256", value: input.price },
        ],
      },
    ],
  };
}

export async function buildBuyAction(input: {
  listingId: number;
  amount: number;
  source: DataSourceMode;
}): Promise<ContractActionResult<null> | null> {
  const { contracts } = await getReadyContracts();
  const marketplace = contracts.marketplace;

  if (!marketplace?.readyForFrontend || !marketplace.deployedAddress) {
    return null;
  }

  return {
    mode: "contract",
    message: "Marketplace contract is configured. Purchase should be executed on-chain.",
    policy: createContractWritePolicy("buy", input.source),
    intents: [
      {
        contractId: "marketplace",
        address: marketplace.deployedAddress,
        method: "buy",
        description: "Buy the listed agent NFT via marketplace escrow.",
        valueSats: input.amount,
        args: [
          { name: "listingId", type: "UINT256", value: input.listingId },
          { name: "amount", type: "UINT256", value: input.amount },
        ],
      },
    ],
  };
}

export async function buildExecutionAction(input: {
  agentId: number;
  userInput: string;
  amount: number;
  source: DataSourceMode;
}): Promise<ContractActionResult<null> | null> {
  const { contracts } = await getReadyContracts();
  const usagePayment = contracts.usagePayment;

  if (!usagePayment?.readyForFrontend || !usagePayment.deployedAddress) {
    return null;
  }

  const inputHash = createHash("sha256").update(input.userInput).digest("hex");

  return {
    mode: "contract",
    message: "UsagePayment is configured. Payment should be signed on-chain before the execution backend runs.",
    policy: createContractWritePolicy("execute", input.source),
    intents: [
      {
        contractId: "usagePayment",
        address: usagePayment.deployedAddress,
        method: "pay",
        description: "Pay for this execution on-chain and anchor the input hash.",
        valueSats: input.amount,
        args: [
          { name: "agentId", type: "UINT256", value: input.agentId },
          { name: "inputHash", type: "STRING", value: `0x${inputHash}` },
          { name: "amount", type: "UINT256", value: input.amount },
        ],
      },
    ],
  };
}
