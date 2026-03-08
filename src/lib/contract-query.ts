import "server-only";

import type { Agent, Listing } from "@/lib/site-data";
import { getContractJournal, type ContractJournalEntry } from "@/lib/contract-journal";
import { getIndexedReceipts } from "@/lib/contract-indexer";
import { getLiveContractState } from "@/lib/live-contract-query";

export type ContractIndexedAgent = Pick<
  Agent,
  | "id"
  | "name"
  | "category"
  | "description"
  | "icon"
  | "owner"
  | "creator"
  | "promptHash"
  | "metadataUri"
  | "pricePerUse"
  | "totalUses"
  | "totalRevenue"
  | "avgRating"
  | "responseTime"
  | "isActive"
  | "royaltyBps"
  | "createdAt"
  | "sampleOutputs"
  | "reviews"
  | "usageHistory"
> & {
  source: "index";
  mintTxId: string;
};

export type ContractIndexedListing = Listing & {
  source: "index";
  listingTxId: string;
  purchaseTxId?: string;
  cancelTxId?: string;
};

function getIntentArg(
  journal: ContractJournalEntry[],
  contractId: string,
  transactionId: string,
  method: string,
  argName: string
) {
  const entry = journal.find((item) =>
    item.receipts.some(
      (receipt) =>
        receipt.contractId === contractId &&
        receipt.method === method &&
        receipt.transactionId === transactionId
    )
  );

  return entry?.intents
    .find((intent) => intent.contractId === contractId && intent.method === method)
    ?.args.find((arg) => arg.name === argName)?.value;
}

export async function getContractIndexedState() {
  try {
    const liveState = await getLiveContractState();
    if (liveState) {
      return {
        agents: liveState.agents as ContractIndexedAgent[],
        listings: liveState.listings as ContractIndexedListing[],
        summary: liveState.summary as {
          agents: number;
          listings: number;
          totalUses: number;
          totalRevenue: number;
          receiptsIndexed: number;
        },
      };
    }
  } catch {
    // Fall back to local journal/index snapshot when live RPC reads are unavailable.
  }

  const [journal, receipts] = await Promise.all([getContractJournal(), getIndexedReceipts()]);
  const agents = new Map<number, ContractIndexedAgent>();
  const listings = new Map<number, ContractIndexedListing>();

  for (const receipt of receipts) {
    if (receipt.contractId === "agentNft") {
      const minted = receipt.events.find((event) => event.type === "AgentMinted");

      if (minted) {
        const agentId = Number(minted.properties.tokenId ?? NaN);
        if (!Number.isNaN(agentId)) {
          const category = Number(minted.properties.category ?? 0) as Agent["category"];
          const pricePerUse = Number(minted.properties.pricePerUse ?? 0);
          const royaltyBps = Number(minted.properties.royaltyBps ?? 0);
          const metadataUri = String(
            getIntentArg(journal, "agentNft", receipt.transactionId, "mint", "metadataURI") ??
              `ipfs://agent-${agentId}`
          );
          const promptHash = String(
            getIntentArg(journal, "agentNft", receipt.transactionId, "mint", "promptHash") ?? "unknown"
          );
          const createdAt = journal
            .find((entry) => entry.receipts.some((item) => item.transactionId === receipt.transactionId))
            ?.createdAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

          agents.set(agentId, {
            id: agentId,
            name: `Indexed Agent #${agentId}`,
            category,
            description: "Materialized from indexed OP_NET events.",
            icon: "IX",
            owner: "indexed-owner",
            creator: "indexed-creator",
            promptHash,
            metadataUri,
            pricePerUse,
            totalUses: 0,
            totalRevenue: 0,
            avgRating: 0,
            responseTime: "chain",
            isActive: true,
            royaltyBps,
            createdAt,
            sampleOutputs: [],
            reviews: [],
            usageHistory: [],
            source: "index",
            mintTxId: receipt.transactionId,
          });
        }
      }
    }

    if (receipt.contractId === "usagePayment") {
      const payment = receipt.events.find((event) => event.type === "PaymentReceived");

      if (payment) {
        const agentId = Number(payment.properties.agentId ?? NaN);
        const amount = Number(payment.properties.amount ?? 0);

        if (!Number.isNaN(agentId)) {
          const current = agents.get(agentId);
          if (current) {
            agents.set(agentId, {
              ...current,
              totalUses: current.totalUses + 1,
              totalRevenue: current.totalRevenue + amount,
              usageHistory: [
                {
                  payer: "indexed-payer",
                  amount,
                  txHash: receipt.transactionId,
                  createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
                },
                ...current.usageHistory,
              ].slice(0, 12),
            });
          }
        }
      }
    }

    if (receipt.contractId === "marketplace") {
      const created = receipt.events.find((event) => event.type === "ListingCreated");
      if (created) {
        const agentId = Number(created.properties.agentId ?? NaN);
        const price = Number(created.properties.price ?? 0);
        if (!Number.isNaN(agentId)) {
          const syntheticListingId = Number(
            getIntentArg(journal, "marketplace", receipt.transactionId, "list", "agentId") ?? agentId
          );
          listings.set(agentId, {
            id: syntheticListingId,
            agentId,
            seller: "indexed-seller",
            price,
            isActive: true,
            createdAt: new Date().toISOString().slice(0, 10),
            source: "index",
            listingTxId: receipt.transactionId,
          });
        }
      }

      const cancelled = receipt.events.find((event) => event.type === "ListingCancelled");
      if (cancelled) {
        const listingId = Number(cancelled.properties.listingId ?? NaN);
        const listing = [...listings.values()].find((item) => item.id === listingId);
        if (listing) {
          listings.set(listing.agentId, {
            ...listing,
            isActive: false,
            cancelTxId: receipt.transactionId,
          });
        }
      }

      const purchased = receipt.events.find((event) => event.type === "ListingPurchased");
      if (purchased) {
        const listingId = Number(purchased.properties.listingId ?? NaN);
        const listing = [...listings.values()].find((item) => item.id === listingId);
        if (listing) {
          listings.set(listing.agentId, {
            ...listing,
            isActive: false,
            purchaseTxId: receipt.transactionId,
          });
        }
      }
    }
  }

  return {
    agents: [...agents.values()].sort((a, b) => b.id - a.id),
    listings: [...listings.values()].sort((a, b) => b.id - a.id),
    summary: {
      agents: agents.size,
      listings: [...listings.values()].filter((listing) => listing.isActive).length,
      totalUses: [...agents.values()].reduce((sum, agent) => sum + agent.totalUses, 0),
      totalRevenue: [...agents.values()].reduce((sum, agent) => sum + agent.totalRevenue, 0),
      receiptsIndexed: receipts.length,
    },
  };
}
