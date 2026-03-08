"use client";

import { useEffect, useState } from "react";

type ContractActivityPayload = {
  summary: {
    totalBroadcasts: number;
    mintedAgents: number;
    payments: number;
    sales: number;
    activeListings: number;
  };
  entries: Array<{
    id: string;
    createdAt: string;
    source: string;
    message: string;
    transactions: Array<{
      contractId: string;
      method: string;
      transactionId: string;
      resolvedTokenId?: number;
    }>;
  }>;
};

export function ContractActivityCard() {
  const [activity, setActivity] = useState<ContractActivityPayload | null>(null);
  const [indexStatus, setIndexStatus] = useState<{
    lastSyncAt: string | null;
    receiptsIndexed: number;
    pendingTransactions: number;
  } | null>(null);
  const [querySummary, setQuerySummary] = useState<{
    agents: number;
    listings: number;
    totalUses: number;
    totalRevenue: number;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadActivity() {
      const [activityResponse, indexerResponse, queryResponse] = await Promise.all([
        fetch("/api/contracts/activity"),
        fetch("/api/contracts/indexer"),
        fetch("/api/contracts/query"),
      ]);
      const payload = (await activityResponse.json()) as ContractActivityPayload;
      const indexerPayload = (await indexerResponse.json()) as {
        lastSyncAt: string | null;
        receiptsIndexed: number;
        pendingTransactions: number;
      };
      const queryPayload = (await queryResponse.json()) as {
        summary: {
          agents: number;
          listings: number;
          totalUses: number;
          totalRevenue: number;
        };
      };

      if (!active) {
        return;
      }

      setActivity(payload);
      setIndexStatus(indexerPayload);
      setQuerySummary(queryPayload.summary);
    }

    void loadActivity();

    return () => {
      active = false;
    };
  }, []);

  async function handleSync() {
    setSyncing(true);

    try {
      const [syncResponse, activityResponse, queryResponse] = await Promise.all([
        fetch("/api/contracts/indexer", { method: "POST" }),
        fetch("/api/contracts/activity"),
        fetch("/api/contracts/query"),
      ]);
      const syncPayload = (await syncResponse.json()) as {
        lastSyncAt: string | null;
        receiptsIndexed: number;
        pendingTransactions?: number;
      };
      const activityPayload = (await activityResponse.json()) as ContractActivityPayload;
      const queryPayload = (await queryResponse.json()) as {
        summary: {
          agents: number;
          listings: number;
          totalUses: number;
          totalRevenue: number;
        };
      };
      setIndexStatus((current) => ({
        lastSyncAt: syncPayload.lastSyncAt,
        receiptsIndexed: syncPayload.receiptsIndexed,
        pendingTransactions: current?.pendingTransactions ?? 0,
      }));
      setActivity(activityPayload);
      setQuerySummary(queryPayload.summary);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/35">On-chain activity</div>
          <h2 className="mt-3 text-2xl font-semibold text-white">Broadcast journal and read model</h2>
        </div>
        <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-sky-200">
          {activity?.summary.totalBroadcasts ?? 0} broadcasts
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm text-white/55">
        <div>
          Indexed receipts: {indexStatus?.receiptsIndexed ?? 0}
          {" · "}
          Pending txs: {Math.max(0, indexStatus?.pendingTransactions ?? 0)}
          {indexStatus?.lastSyncAt ? ` · last sync ${new Date(indexStatus.lastSyncAt).toLocaleString()}` : ""}
        </div>
        <button
          onClick={() => void handleSync()}
          disabled={syncing}
          className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200 disabled:opacity-60"
        >
          {syncing ? "Syncing..." : "Sync indexer"}
        </button>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        {[
          ["Mints", activity?.summary.mintedAgents ?? 0],
          ["Payments", activity?.summary.payments ?? 0],
          ["Sales", activity?.summary.sales ?? 0],
          ["Active listings", activity?.summary.activeListings ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        {[
          ["Indexed agents", querySummary?.agents ?? 0],
          ["Indexed listings", querySummary?.listings ?? 0],
          ["Indexed uses", querySummary?.totalUses ?? 0],
          ["Indexed revenue", `${(querySummary?.totalRevenue ?? 0).toLocaleString()} sats`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[24px] border border-sky-400/15 bg-sky-400/5 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {(activity?.entries ?? []).map((entry) => (
          <div key={entry.id} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">{entry.message}</div>
                <div className="mt-1 text-sm text-white/45">
                  {entry.source} · {new Date(entry.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.transactions.map((transaction) => (
                <span key={`${entry.id}-${transaction.transactionId}`} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  {transaction.contractId}.{transaction.method}
                  {transaction.resolvedTokenId !== undefined ? ` #${transaction.resolvedTokenId}` : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
