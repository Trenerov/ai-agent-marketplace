import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { getContractJournal } from "@/lib/contract-journal";
import { getOpnetScriptPath } from "@/lib/opnet-script-path";

export type IndexedReceipt = {
  contractId: string;
  transactionId: string;
  reverted: string | null;
  events: Array<{
    type: string;
    properties: Record<string, unknown>;
  }>;
};

type ContractIndexSnapshot = {
  lastSyncAt: string | null;
  receipts: IndexedReceipt[];
};

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "contract-index.json");

async function ensureIndexFile() {
  await mkdir(DB_DIR, { recursive: true });

  try {
    await readFile(DB_PATH, "utf8");
  } catch {
    await writeFile(DB_PATH, JSON.stringify({ lastSyncAt: null, receipts: [] }, null, 2), "utf8");
  }
}

async function readIndexSnapshot() {
  await ensureIndexFile();
  const raw = await readFile(DB_PATH, "utf8");
  return JSON.parse(raw) as ContractIndexSnapshot;
}

async function writeIndexSnapshot(snapshot: ContractIndexSnapshot) {
  await ensureIndexFile();
  await writeFile(DB_PATH, JSON.stringify(snapshot, null, 2), "utf8");
}

function runEventSyncScript(transactions: Array<{ contractId: string; transactionId: string }>) {
  const scriptPath = getOpnetScriptPath("fetch-transaction-events.mjs");

  return new Promise<{ ok: boolean; receipts: IndexedReceipt[]; error?: string }>((resolve, reject) => {
    const child = spawn("node", [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      const raw = stdout || stderr;

      try {
        const parsed = JSON.parse(raw) as { ok: boolean; receipts: IndexedReceipt[]; error?: string };

        if (code === 0) {
          resolve(parsed);
          return;
        }

        reject(parsed);
      } catch {
        reject(new Error(raw || `Event sync script exited with code ${code ?? "unknown"}`));
      }
    });

    child.stdin.write(JSON.stringify({ transactions }));
    child.stdin.end();
  });
}

export async function syncContractIndex() {
  const [snapshot, journal] = await Promise.all([readIndexSnapshot(), getContractJournal()]);
  const known = new Set(snapshot.receipts.map((receipt) => `${receipt.contractId}:${receipt.transactionId}`));
  const pending = journal
    .flatMap((entry) =>
      entry.receipts.map((receipt) => ({
        contractId: receipt.contractId,
        transactionId: receipt.transactionId,
      }))
    )
    .filter((receipt) => !known.has(`${receipt.contractId}:${receipt.transactionId}`));

  if (pending.length === 0) {
    return {
      lastSyncAt: snapshot.lastSyncAt,
      receiptsIndexed: snapshot.receipts.length,
      newlyIndexed: 0,
      fallback: false,
      error: null,
    };
  }

  try {
    const payload = await runEventSyncScript(pending);
    const nextSnapshot = {
      lastSyncAt: new Date().toISOString(),
      receipts: [...payload.receipts, ...snapshot.receipts],
    } satisfies ContractIndexSnapshot;
    await writeIndexSnapshot(nextSnapshot);

    return {
      lastSyncAt: nextSnapshot.lastSyncAt,
      receiptsIndexed: nextSnapshot.receipts.length,
      newlyIndexed: payload.receipts.length,
      fallback: false,
      error: null,
    };
  } catch (error) {
    return {
      lastSyncAt: snapshot.lastSyncAt,
      receiptsIndexed: snapshot.receipts.length,
      newlyIndexed: 0,
      fallback: true,
      error: error instanceof Error ? error.message : "Event sync failed",
    };
  }
}

export async function getContractIndexStatus() {
  const [snapshot, journal] = await Promise.all([readIndexSnapshot(), getContractJournal()]);
  const pendingTransactions = Math.max(
    0,
    journal.flatMap((entry) => entry.receipts).length - snapshot.receipts.length
  );

  return {
    lastSyncAt: snapshot.lastSyncAt,
    receiptsIndexed: snapshot.receipts.length,
    pendingTransactions,
    recentEvents: snapshot.receipts.slice(0, 10),
  };
}

export async function getIndexedReceipts() {
  const snapshot = await readIndexSnapshot();
  return snapshot.receipts;
}
