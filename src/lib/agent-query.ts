import "server-only";

import type { Agent, Listing } from "@/lib/site-data";
import { type DataSourceMode } from "@/lib/data-source";
import { getContractIndexedState } from "@/lib/contract-query";
import {
  getAgentById,
  getAgents,
  getListingByAgentId,
  getListings,
  getLocalAgentById,
  getLocalAgents,
  getLocalListingByAgentId,
  getLocalListings,
  getUserSummary,
  getUserSummaryLocal,
} from "@/lib/store";

type IndexedState = Awaited<ReturnType<typeof getContractIndexedState>>;

function mapIndexedAgent(agent: IndexedState["agents"][number]): Agent & {
  chainSource: "synthetic";
  onChainMintTxId: string;
} {
  return {
    ...agent,
    chainSource: "synthetic",
    onChainMintTxId: agent.mintTxId,
  };
}

function mapIndexedListing(listing: IndexedState["listings"][number]): Listing & {
  chainSource: "overlay";
  onChainListingTxId: string;
} {
  return {
    ...listing,
    chainSource: "overlay",
    onChainListingTxId: listing.listingTxId,
  };
}

export async function queryAgents(mode: DataSourceMode) {
  if (mode === "local") {
    return getLocalAgents();
  }

  if (mode === "index") {
    const indexed = await getContractIndexedState();
    return indexed.agents.map(mapIndexedAgent);
  }

  return getAgents();
}

export async function queryAgentById(mode: DataSourceMode, id: number) {
  if (mode === "local") {
    return getLocalAgentById(id);
  }

  if (mode === "index") {
    const indexed = await getContractIndexedState();
    const agent = indexed.agents.find((item) => item.id === id);
    return agent ? mapIndexedAgent(agent) : undefined;
  }

  return getAgentById(id);
}

export async function queryListings(mode: DataSourceMode) {
  if (mode === "local") {
    return getLocalListings();
  }

  if (mode === "index") {
    const indexed = await getContractIndexedState();
    return indexed.listings.map(mapIndexedListing);
  }

  return getListings();
}

export async function queryListingByAgentId(mode: DataSourceMode, agentId: number) {
  if (mode === "local") {
    return getLocalListingByAgentId(agentId);
  }

  if (mode === "index") {
    const indexed = await getContractIndexedState();
    const listing = indexed.listings.find((item) => item.agentId === agentId && item.isActive);
    return listing ? mapIndexedListing(listing) : undefined;
  }

  return getListingByAgentId(agentId);
}

export async function queryUserAgents(mode: DataSourceMode, address: string) {
  if (mode === "local") {
    const summary = await getUserSummaryLocal(address);
    return summary.agents;
  }

  if (mode === "index") {
    const indexed = await getContractIndexedState();
    return indexed.agents
      .map(mapIndexedAgent)
      .filter((agent) => agent.owner === address || agent.creator === address);
  }

  const summary = await getUserSummary(address);
  return summary.agents;
}

export async function queryUserSummary(mode: DataSourceMode, address: string) {
  if (mode === "local") {
    return getUserSummaryLocal(address);
  }

  if (mode === "index") {
    const indexed = await getContractIndexedState();
    const agents = indexed.agents
      .map(mapIndexedAgent)
      .filter((agent) => agent.owner === address || agent.creator === address);

    return {
      address,
      agents,
      usageCount: agents.reduce((sum, agent) => sum + agent.totalUses, 0),
      totalEarned: agents.reduce((sum, agent) => sum + agent.totalRevenue, 0),
      payments: agents.flatMap((agent) =>
        agent.usageHistory.map((entry, index) => ({
          id: `${agent.id}-${index}-${entry.txHash}`,
          agentId: agent.id,
          payer: entry.payer,
          amount: entry.amount,
          txHash: entry.txHash,
          executionId: null,
          createdAt: entry.createdAt,
        }))
      ),
      activity: agents.map((agent) => ({
        id: `indexed-${agent.id}`,
        title: `Indexed agent ${agent.name}`,
        detail: `${agent.totalUses.toLocaleString()} runs · ${agent.totalRevenue.toLocaleString()} sats`,
        timestamp: agent.createdAt,
        type: "mint" as const,
      })),
    };
  }

  return getUserSummary(address);
}
