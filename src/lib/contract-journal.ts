import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  BroadcastReceipt,
  ContractActionEnvelope,
  PresignedBroadcastReceipt,
  PresignedTransactionPackage,
} from "@/lib/contract-intent";

export type ContractJournalEntry = {
  id: string;
  createdAt: string;
  source: "server-broadcast" | "presigned-broadcast";
  message: string;
  intents: Array<{
    contractId: string;
    method: string;
    description: string;
    valueSats?: number;
    args: Array<{ name: string; type: string; value: string | number }>;
  }>;
  receipts: Array<{
    contractId: string;
    method: string;
    transactionId: string;
    resolvedTokenId?: number;
  }>;
};

type ContractJournalDb = {
  entries: ContractJournalEntry[];
};

export type ContractActivitySummary = {
  totalBroadcasts: number;
  mintedAgents: number;
  payments: number;
  sales: number;
  activeListings: number;
};

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "contract-journal.json");

async function ensureJournalFile() {
  await mkdir(DB_DIR, { recursive: true });

  try {
    await readFile(DB_PATH, "utf8");
  } catch {
    await writeFile(DB_PATH, JSON.stringify({ entries: [] }, null, 2), "utf8");
  }
}

async function readJournalDb() {
  await ensureJournalFile();
  const raw = await readFile(DB_PATH, "utf8");
  return JSON.parse(raw) as ContractJournalDb;
}

async function writeJournalDb(db: ContractJournalDb) {
  await ensureJournalFile();
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export async function recordIntentBroadcast(
  envelope: ContractActionEnvelope,
  receipts: BroadcastReceipt[],
  source: ContractJournalEntry["source"] = "server-broadcast"
) {
  const db = await readJournalDb();

  db.entries.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source,
    message: envelope.message,
    intents: envelope.intents,
    receipts: receipts.map((receipt) => ({
      contractId: receipt.contractId,
      method: receipt.method,
      transactionId: receipt.transactionId,
      resolvedTokenId: receipt.resolvedTokenId,
    })),
  });

  await writeJournalDb(db);
}

export async function recordPresignedBroadcast(
  packages: PresignedTransactionPackage[],
  receipts: PresignedBroadcastReceipt[]
) {
  const db = await readJournalDb();

  db.entries.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: "presigned-broadcast",
    message: "Client-signed raw transactions were broadcast to OP_NET.",
    intents: packages.map((pkg) => ({
      contractId: pkg.contractId,
      method: pkg.method,
      description: "Broadcast from client-signed raw transaction payload.",
      args: [],
    })),
    receipts: receipts.map((receipt) => ({
      contractId: receipt.contractId,
      method: receipt.method,
      transactionId: receipt.interactionTransactionId,
    })),
  });

  await writeJournalDb(db);
}

export async function getContractJournal() {
  const db = await readJournalDb();
  return db.entries;
}

export async function getContractActivity() {
  const entries = await getContractJournal();

  let activeListings = 0;
  let mintedAgents = 0;
  let payments = 0;
  let sales = 0;

  for (const entry of entries) {
    for (const receipt of entry.receipts) {
      if (receipt.contractId === "agentNft" && receipt.method === "mint") {
        mintedAgents += 1;
      }

      if (receipt.contractId === "usagePayment" && receipt.method === "pay") {
        payments += 1;
      }

      if (receipt.contractId === "marketplace" && receipt.method === "list") {
        activeListings += 1;
      }

      if (receipt.contractId === "marketplace" && receipt.method === "cancelListing") {
        activeListings = Math.max(0, activeListings - 1);
      }

      if (receipt.contractId === "marketplace" && receipt.method === "buy") {
        sales += 1;
        activeListings = Math.max(0, activeListings - 1);
      }
    }
  }

  const summary: ContractActivitySummary = {
    totalBroadcasts: entries.length,
    mintedAgents,
    payments,
    sales,
    activeListings,
  };

  return {
    summary,
    entries: entries.slice(0, 10).map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      source: entry.source,
      message: entry.message,
      transactions: entry.receipts.map((receipt) => ({
        contractId: receipt.contractId,
        method: receipt.method,
        transactionId: receipt.transactionId,
        resolvedTokenId: receipt.resolvedTokenId,
      })),
    })),
  };
}
