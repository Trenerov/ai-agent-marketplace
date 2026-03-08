import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  getReadModelAgentById,
  getReadModelAgents,
  getReadModelListingByAgentId,
  getReadModelListings,
} from "@/lib/contract-read-model";
import { encryptPrompt } from "@/lib/crypto";
import { activeListings, activityFeed, seededAgents, walletSummary } from "@/lib/site-data";

export type ExecutionRecord = {
  id: string;
  agentId: number;
  payer: string;
  paymentTxId: string;
  input: string;
  result: string;
  status: "completed" | "failed";
  cost: number;
  backendMode: string;
  provider: string;
  model: string;
  latencyMs: number;
  promptDigest: string;
  createdAt: string;
  completedAt: string;
};

export type PaymentRecord = {
  id: string;
  agentId: number;
  payer: string;
  amount: number;
  txHash: string;
  executionId: string | null;
  createdAt: string;
};

export type ActivityRecord = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  type: "sale" | "payment" | "mint";
};

export type MarketplaceDb = {
  agents: typeof seededAgents;
  listings: typeof activeListings;
  executions: ExecutionRecord[];
  payments: PaymentRecord[];
  activity: ActivityRecord[];
};

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "marketplace-db.json");

function createInitialDb(): MarketplaceDb {
  const payments = seededAgents.flatMap((agent) =>
    agent.usageHistory.map((entry) => ({
      id: randomUUID(),
      agentId: agent.id,
      payer: entry.payer,
      amount: entry.amount,
      txHash: entry.txHash,
      executionId: null,
      createdAt: entry.createdAt,
    }))
  );

  const activity = activityFeed.map((item) => ({
    id: randomUUID(),
    ...item,
  }));

  return {
    agents: seededAgents,
    listings: activeListings,
    executions: [],
    payments,
    activity,
  };
}

async function ensureDbFile() {
  await mkdir(DB_DIR, { recursive: true });

  try {
    await readFile(DB_PATH, "utf8");
  } catch {
    const initialDb = createInitialDb();
    await writeFile(DB_PATH, JSON.stringify(initialDb, null, 2), "utf8");
  }
}

export async function readDb() {
  await ensureDbFile();
  const raw = await readFile(DB_PATH, "utf8");
  return JSON.parse(raw) as MarketplaceDb;
}

export async function writeDb(db: MarketplaceDb) {
  await ensureDbFile();
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export async function getAgents() {
  const db = await readDb();
  return getReadModelAgents(db.agents);
}

export async function getLocalAgents() {
  const db = await readDb();
  return db.agents;
}

export async function getAgentById(id: number) {
  const db = await readDb();
  return getReadModelAgentById(db.agents, id);
}

export async function getLocalAgentById(id: number) {
  const db = await readDb();
  return db.agents.find((agent) => agent.id === id);
}

export async function getListings() {
  const db = await readDb();
  return getReadModelListings(db.listings, db.agents);
}

export async function getLocalListings() {
  const db = await readDb();
  return db.listings;
}

export async function getListingByAgentId(agentId: number) {
  const db = await readDb();
  return getReadModelListingByAgentId(db.listings, db.agents, agentId);
}

export async function getLocalListingByAgentId(agentId: number) {
  const db = await readDb();
  return db.listings.find((listing) => listing.agentId === agentId && listing.isActive);
}

export async function createListing(input: {
  agentId: number;
  price: number;
  seller: string;
}) {
  const db = await readDb();
  const nextId = db.listings.reduce((max, listing) => Math.max(max, listing.id), 100) + 1;

  const existing = db.listings.find((listing) => listing.agentId === input.agentId && listing.isActive);
  if (existing) {
    return existing;
  }

  const listing = {
    id: nextId,
    agentId: input.agentId,
    seller: input.seller,
    price: input.price,
    isActive: true,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  db.listings.unshift(listing);
  db.activity.unshift({
    id: randomUUID(),
    title: "Secondary sale opened",
    detail: `Agent #${input.agentId} was listed for ${input.price} sats.`,
    timestamp: "just now",
    type: "sale",
  });

  await writeDb(db);
  return listing;
}

export async function purchaseListing(input: {
  listingId: number;
  buyer: string;
}) {
  const db = await readDb();
  const listingIndex = db.listings.findIndex((listing) => listing.id === input.listingId && listing.isActive);

  if (listingIndex < 0) {
    return null;
  }

  const listing = db.listings[listingIndex];
  const agentIndex = db.agents.findIndex((agent) => agent.id === listing.agentId);

  if (agentIndex < 0) {
    return null;
  }

  const agent = db.agents[agentIndex];
  db.listings[listingIndex] = { ...listing, isActive: false };
  db.agents[agentIndex] = { ...agent, owner: input.buyer };
  db.activity.unshift({
    id: randomUUID(),
    title: "Secondary sale closed",
    detail: `${agent.name} sold for ${listing.price} sats to ${input.buyer}.`,
    timestamp: "just now",
    type: "sale",
  });

  await writeDb(db);
  return {
    listing: db.listings[listingIndex],
    agent: db.agents[agentIndex],
  };
}

export async function createAgent(input: {
  name: string;
  description: string;
  category: number;
  prompt: string;
  pricePerUse: number;
  royaltyBps: number;
  owner?: string;
}) {
  const db = await readDb();
  const nextId = db.agents.reduce((max, agent) => Math.max(max, agent.id), 0) + 1;
  const owner = input.owner || walletSummary.address;
  const createdAt = new Date().toISOString().slice(0, 10);
  const encrypted = encryptPrompt(input.prompt);

  const agent = {
    id: nextId,
    name: input.name,
    category: input.category as 0 | 1 | 2 | 3 | 4 | 5,
    description: input.description,
    icon: input.name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "AG",
    owner,
    creator: owner,
    promptHash: encrypted.promptHash,
    metadataUri: `ipfs://${input.name.toLowerCase().replace(/\s+/g, "-")}-${nextId}`,
    pricePerUse: input.pricePerUse,
    totalUses: 0,
    totalRevenue: 0,
    avgRating: 0,
    responseTime: "0.0s",
    isActive: true,
    royaltyBps: input.royaltyBps,
    createdAt,
    promptCiphertext: encrypted.promptCiphertext,
    promptIv: encrypted.promptIv,
    promptTag: encrypted.promptTag,
    sampleOutputs: [
      {
        input: "Sample test input from the mint wizard.",
        output: `Preview response for ${input.name}. This placeholder is generated from the submitted prompt and category.`,
      },
    ],
    reviews: [],
    usageHistory: [],
  };

  db.agents.unshift(agent);
  db.activity.unshift({
    id: randomUUID(),
    title: "New mint queued",
    detail: `${agent.name} was minted by ${owner} and added to the active registry.`,
    timestamp: "just now",
    type: "mint",
  });

  await writeDb(db);
  return agent;
}

export async function executeAgent(input: {
  agentId: number;
  userInput: string;
  payer?: string;
  paymentTxId: string;
  result: string;
  backendMode: string;
  provider: string;
  model: string;
  latencyMs: number;
  promptDigest: string;
}) {
  const db = await readDb();
  const agentIndex = db.agents.findIndex((agent) => agent.id === input.agentId);

  if (agentIndex < 0) {
    return null;
  }

  const agent = db.agents[agentIndex];
  const payer = input.payer || walletSummary.address;
  const now = new Date().toISOString();
  const executionId = `exec_${randomUUID()}`;

  const execution: ExecutionRecord = {
    id: executionId,
    agentId: agent.id,
    payer,
    paymentTxId: input.paymentTxId,
    input: input.userInput,
    result: input.result,
    status: "completed",
    cost: agent.pricePerUse,
    backendMode: input.backendMode,
    provider: input.provider,
    model: input.model,
    latencyMs: input.latencyMs,
    promptDigest: input.promptDigest,
    createdAt: now,
    completedAt: now,
  };

  const updatedAgent = {
    ...agent,
    totalUses: agent.totalUses + 1,
    totalRevenue: agent.totalRevenue + agent.pricePerUse,
    responseTime: "3.8s",
    usageHistory: [
      {
        payer,
        amount: agent.pricePerUse,
        txHash: input.paymentTxId,
        createdAt: now.replace("T", " ").slice(0, 16),
      },
      ...agent.usageHistory,
    ].slice(0, 12),
  };

  db.agents[agentIndex] = updatedAgent;
  db.executions.unshift(execution);
  db.payments.unshift({
    id: randomUUID(),
    agentId: agent.id,
    payer,
    amount: agent.pricePerUse,
    txHash: input.paymentTxId,
    executionId,
    createdAt: now,
  });
  db.activity.unshift({
    id: randomUUID(),
    title: "Paid execution completed",
    detail: `${updatedAgent.name} processed a paid request for ${agent.pricePerUse} sats.`,
    timestamp: "just now",
    type: "payment",
  });

  await writeDb(db);
  return execution;
}

export async function getExecutionById(id: string) {
  const db = await readDb();
  return db.executions.find((execution) => execution.id === id);
}

export async function getUserSummary(address: string) {
  const db = await readDb();
  const agents = db.agents.filter((agent) => agent.owner === address || agent.creator === address);
  const payments = db.payments.filter((payment) => payment.payer === address);
  const totalEarned = agents.reduce((sum, agent) => sum + agent.totalRevenue, 0);
  const usageCount = payments.length;

  return {
    address,
    agents,
    usageCount,
    totalEarned,
    payments,
    activity: db.activity.slice(0, 10),
  };
}

export async function getUserSummaryLocal(address: string) {
  return getUserSummary(address);
}
