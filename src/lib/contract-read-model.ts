import "server-only";

import type { Agent, Listing } from "@/lib/site-data";
import type { ContractJournalEntry } from "@/lib/contract-journal";
import { getContractJournal } from "@/lib/contract-journal";
import { getIndexedReceipts, type IndexedReceipt } from "@/lib/contract-indexer";

export type ReadModelAgent = Agent & {
  chainSource: "local" | "overlay" | "synthetic";
  onChainMintTxId?: string;
  onChainLastPaymentTxId?: string;
  onChainListed?: boolean;
  onChainListingTxId?: string;
};

export type ReadModelListing = Listing & {
  chainSource: "local" | "overlay";
  onChainListingTxId?: string;
};

type AgentOverlayState = {
  agent?: ReadModelAgent;
  listing?: ReadModelListing | null;
};

function getArgValue(
  entry: ContractJournalEntry,
  contractId: string,
  method: string,
  argName: string
) {
  const intent = entry.intents.find(
    (candidate) => candidate.contractId === contractId && candidate.method === method
  );

  return intent?.args.find((arg) => arg.name === argName)?.value;
}

function getIndexedReceipt(
  indexedReceipts: IndexedReceipt[],
  contractId: string,
  transactionId: string
) {
  return indexedReceipts.find(
    (receipt) =>
      receipt.contractId === contractId && receipt.transactionId === transactionId
  );
}

function getIndexedEventProperty(
  indexedReceipts: IndexedReceipt[],
  contractId: string,
  transactionId: string,
  eventType: string,
  propertyName: string
) {
  const receipt = getIndexedReceipt(indexedReceipts, contractId, transactionId);
  const event = receipt?.events.find((item) => item.type === eventType);
  return event?.properties?.[propertyName];
}

function createSyntheticAgent(
  agentId: number,
  entry: ContractJournalEntry,
  txId: string,
  indexedReceipts: IndexedReceipt[]
): ReadModelAgent {
  const categoryArg =
    getIndexedEventProperty(indexedReceipts, "agentNft", txId, "AgentMinted", "category") ??
    getArgValue(entry, "agentNft", "mint", "category");
  const priceArg =
    getIndexedEventProperty(indexedReceipts, "agentNft", txId, "AgentMinted", "pricePerUse") ??
    getArgValue(entry, "agentNft", "mint", "pricePerUse");
  const metadataArg = getArgValue(entry, "agentNft", "mint", "metadataURI");
  const promptHashArg = getArgValue(entry, "agentNft", "mint", "promptHash");
  const royaltyArg =
    getIndexedEventProperty(indexedReceipts, "agentNft", txId, "AgentMinted", "royaltyBps") ??
    getArgValue(entry, "agentNft", "mint", "royaltyBps");
  const createdAt = new Date(entry.createdAt).toISOString().slice(0, 10);

  return {
    id: agentId,
    name: `On-chain Agent #${agentId}`,
    category: Number(categoryArg ?? 0) as Agent["category"],
    description: "Minted on-chain through OP_NET. Metadata is available, but off-chain descriptive fields were not yet indexed into the local read model.",
    icon: "OC",
    owner: "on-chain owner",
    creator: "on-chain creator",
    promptHash: String(promptHashArg ?? "unknown"),
    metadataUri: String(metadataArg ?? `ipfs://agent-${agentId}`),
    pricePerUse: Number(priceArg ?? 0),
    totalUses: 0,
    totalRevenue: 0,
    avgRating: 0,
    responseTime: "chain",
    isActive: true,
    royaltyBps: Number(royaltyArg ?? 0),
    createdAt,
    sampleOutputs: [],
    reviews: [],
    usageHistory: [],
    chainSource: "synthetic",
    onChainMintTxId: txId,
    onChainListed: false,
  };
}

function buildOverlayMap(entries: ContractJournalEntry[], indexedReceipts: IndexedReceipt[]) {
  const overlays = new Map<number, AgentOverlayState>();

  for (const entry of entries) {
    for (const receipt of entry.receipts) {
      if (receipt.contractId === "agentNft" && receipt.method === "mint" && receipt.resolvedTokenId !== undefined) {
        const agentId = receipt.resolvedTokenId;
        const current = overlays.get(agentId) ?? {};
        const nextAgent =
          current.agent ??
          createSyntheticAgent(agentId, entry, receipt.transactionId, indexedReceipts);

        overlays.set(agentId, {
          ...current,
          agent: {
            ...nextAgent,
            onChainMintTxId: receipt.transactionId,
            chainSource: current.agent ? "overlay" : nextAgent.chainSource,
          },
        });
      }

      if (receipt.contractId === "usagePayment" && receipt.method === "pay") {
        const agentId = Number(getArgValue(entry, "usagePayment", "pay", "agentId") ?? NaN);
        if (Number.isNaN(agentId)) {
          continue;
        }

        const current = overlays.get(agentId) ?? {};
        const baseAgent =
          current.agent ?? createSyntheticAgent(agentId, entry, receipt.transactionId, indexedReceipts);
        const amount = Number(
          getIndexedEventProperty(indexedReceipts, "usagePayment", receipt.transactionId, "PaymentReceived", "amount") ??
            getArgValue(entry, "usagePayment", "pay", "amount") ??
            0
        );

        overlays.set(agentId, {
          ...current,
          agent: {
            ...baseAgent,
            totalUses: baseAgent.totalUses + 1,
            totalRevenue: baseAgent.totalRevenue + amount,
            pricePerUse: amount || baseAgent.pricePerUse,
            onChainLastPaymentTxId: receipt.transactionId,
            chainSource: current.agent ? "overlay" : baseAgent.chainSource,
            usageHistory: [
              {
                payer: "on-chain payer",
                amount,
                txHash: receipt.transactionId,
                createdAt: new Date(entry.createdAt).toISOString().replace("T", " ").slice(0, 16),
              },
              ...baseAgent.usageHistory,
            ].slice(0, 12),
          },
        });
      }

      if (receipt.contractId === "marketplace" && receipt.method === "list") {
        const agentId = Number(getArgValue(entry, "marketplace", "list", "agentId") ?? NaN);
        if (Number.isNaN(agentId)) {
          continue;
        }

        const current = overlays.get(agentId) ?? {};
        const baseAgent =
          current.agent ?? createSyntheticAgent(agentId, entry, receipt.transactionId, indexedReceipts);
        const price = Number(
          getIndexedEventProperty(indexedReceipts, "marketplace", receipt.transactionId, "ListingCreated", "price") ??
            getArgValue(entry, "marketplace", "list", "price") ??
            baseAgent.pricePerUse
        );

        overlays.set(agentId, {
          agent: {
            ...baseAgent,
            onChainListed: true,
            onChainListingTxId: receipt.transactionId,
            chainSource: current.agent ? "overlay" : baseAgent.chainSource,
          },
          listing: {
            id: Math.abs(agentId * 1000 + new Date(entry.createdAt).getTime() % 1000),
            agentId,
            seller: "on-chain seller",
            price,
            isActive: true,
            createdAt: new Date(entry.createdAt).toISOString().slice(0, 10),
            chainSource: "overlay",
            onChainListingTxId: receipt.transactionId,
          },
        });
      }

      if (receipt.contractId === "marketplace" && receipt.method === "buy") {
        const listingId = Number(
          getIndexedEventProperty(indexedReceipts, "marketplace", receipt.transactionId, "ListingPurchased", "listingId") ??
            getArgValue(entry, "marketplace", "buy", "listingId") ??
            NaN
        );
        const amount = Number(
          getIndexedEventProperty(indexedReceipts, "marketplace", receipt.transactionId, "ListingPurchased", "amount") ??
            getArgValue(entry, "marketplace", "buy", "amount") ??
            0
        );
        if (Number.isNaN(listingId)) {
          continue;
        }

        const current = overlays.get(listingId);
        if (!current) {
          continue;
        }

        overlays.set(listingId, {
          agent: current.agent
            ? {
                ...current.agent,
                onChainListed: false,
                totalRevenue: current.agent.totalRevenue + amount,
              }
            : undefined,
          listing: current.listing ? { ...current.listing, isActive: false } : null,
        });
      }

      if (receipt.contractId === "marketplace" && receipt.method === "cancelListing") {
        const listingId = Number(
          getIndexedEventProperty(indexedReceipts, "marketplace", receipt.transactionId, "ListingCancelled", "listingId") ??
            getArgValue(entry, "marketplace", "cancelListing", "listingId") ??
            NaN
        );
        if (Number.isNaN(listingId)) {
          continue;
        }

        const current = overlays.get(listingId);
        if (!current) {
          continue;
        }

        overlays.set(listingId, {
          agent: current.agent
            ? {
                ...current.agent,
                onChainListed: false,
              }
            : undefined,
          listing: current.listing ? { ...current.listing, isActive: false } : null,
        });
      }

    }
  }

  return overlays;
}

export async function getReadModelAgents(baseAgents: Agent[]) {
  const [entries, indexedReceipts] = await Promise.all([getContractJournal(), getIndexedReceipts()]);
  const overlays = buildOverlayMap(entries, indexedReceipts);
  const merged = new Map<number, ReadModelAgent>();

  for (const agent of baseAgents) {
    const overlay = overlays.get(agent.id)?.agent;
    merged.set(agent.id, {
      ...agent,
      ...(overlay
        ? {
            totalUses: Math.max(agent.totalUses, overlay.totalUses),
            totalRevenue: Math.max(agent.totalRevenue, overlay.totalRevenue),
            pricePerUse: overlay.pricePerUse || agent.pricePerUse,
            usageHistory:
              overlay.usageHistory.length > agent.usageHistory.length ? overlay.usageHistory : agent.usageHistory,
            onChainMintTxId: overlay.onChainMintTxId,
            onChainLastPaymentTxId: overlay.onChainLastPaymentTxId,
            onChainListed: overlay.onChainListed,
            onChainListingTxId: overlay.onChainListingTxId,
            chainSource: "overlay",
          }
        : { chainSource: "local" }),
    });
  }

  for (const [agentId, overlay] of overlays.entries()) {
    if (overlay.agent && !merged.has(agentId)) {
      merged.set(agentId, overlay.agent);
    }
  }

  return [...merged.values()];
}

export async function getReadModelAgentById(baseAgents: Agent[], agentId: number) {
  const agents = await getReadModelAgents(baseAgents);
  return agents.find((agent) => agent.id === agentId);
}

export async function getReadModelListings(baseListings: Listing[], baseAgents: Agent[]) {
  const [entries, indexedReceipts, agents] = await Promise.all([
    getContractJournal(),
    getIndexedReceipts(),
    getReadModelAgents(baseAgents),
  ]);
  const overlays = buildOverlayMap(entries, indexedReceipts);
  const merged = new Map<number, ReadModelListing>();

  for (const listing of baseListings) {
    const overlay = overlays.get(listing.agentId)?.listing;
    merged.set(listing.agentId, {
      ...listing,
      ...(overlay
        ? {
            price: overlay.price,
            isActive: overlay.isActive,
            onChainListingTxId: overlay.onChainListingTxId,
            chainSource: "overlay",
          }
        : { chainSource: "local" }),
    });
  }

  for (const agent of agents) {
    const overlayListing = overlays.get(agent.id)?.listing;
    if (overlayListing && !merged.has(agent.id)) {
      merged.set(agent.id, overlayListing);
    }
  }

  return [...merged.values()];
}

export async function getReadModelListingByAgentId(
  baseListings: Listing[],
  baseAgents: Agent[],
  agentId: number
) {
  const listings = await getReadModelListings(baseListings, baseAgents);
  return listings.find((listing) => listing.agentId === agentId && listing.isActive);
}
