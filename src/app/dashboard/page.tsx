"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { revenueSeries, walletSummary } from "@/lib/site-data";

const RevenueChart = dynamic(
  () => import("@/components/DashboardCharts").then((module) => module.RevenueChart),
  { ssr: false }
);

const UsageChart = dynamic(
  () => import("@/components/DashboardCharts").then((module) => module.UsageChart),
  { ssr: false }
);

type DashboardAgent = {
  id: number;
  name: string;
  totalUses: number;
  totalRevenue: number;
};

type HistoryPayload = {
  source?: string;
  payments: Array<{ id: string; amount: number; txHash: string; createdAt: string }>;
  usageCount: number;
  activity: Array<{ id: string; title: string; detail: string; timestamp: string }>;
};

type EarningsPayload = {
  source?: string;
  totalEarned: number;
  activeAgents: number;
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const { address, balance, connected, connect, network, mode } = useWallet();
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [earnings, setEarnings] = useState<EarningsPayload | null>(null);
  const source = searchParams.get("source") || "overlay";

  useEffect(() => {
    if (!address) {
      queueMicrotask(() => {
        setAgents([]);
        setHistory(null);
        setEarnings(null);
      });
      return;
    }

    let active = true;
    const walletAddress = address;

    async function loadDashboard() {
      const encoded = encodeURIComponent(walletAddress);
      const query = new URLSearchParams({ source }).toString();
      const [agentsResponse, historyResponse, earningsResponse] = await Promise.all([
        fetch(`/api/user/${encoded}/agents?${query}`),
        fetch(`/api/user/${encoded}/history?${query}`),
        fetch(`/api/user/${encoded}/earnings?${query}`),
      ]);

      const agentsData = (await agentsResponse.json()) as { agents?: DashboardAgent[] };
      const historyData = (await historyResponse.json()) as HistoryPayload;
      const earningsData = (await earningsResponse.json()) as EarningsPayload;

      if (!active) {
        return;
      }

      setAgents(agentsData.agents ?? []);
      setHistory(historyData);
      setEarnings(earningsData);
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [address, source]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.34em] text-white/35">Dashboard</div>
          <h1 className="text-4xl font-semibold text-white">Control panel for agents, earnings and usage</h1>
        </div>
        <div className="rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2 text-sm text-[#f7b15a]">
          {address ?? "wallet not connected"}
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          { label: "Balance", value: connected ? balance : "0 BTC" },
          { label: "Active agents", value: String(earnings?.activeAgents ?? 0) },
          { label: "Total earned", value: `${(earnings?.totalEarned ?? 0).toLocaleString()} sats` },
          { label: "Network", value: network || walletSummary.network },
        ].map((item) => (
          <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-white/35">{item.label}</div>
            <div className="mt-3 text-2xl font-semibold text-white">{item.value}</div>
          </div>
        ))}
      </section>

      {!connected ? (
        <div className="mb-8 rounded-[24px] border border-[#f7931a]/20 bg-[#f7931a]/8 p-5 text-sm text-[#f7b15a]">
          Dashboard is wallet-scoped. Connect a wallet to load creator agents, payments and activity.
          <button
            onClick={() => void connect()}
            className="ml-4 rounded-full bg-[#f7931a] px-4 py-2 text-sm font-semibold text-black"
          >
            Connect wallet
          </button>
        </div>
      ) : (
        <div className="mb-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
          Wallet connected as {address}. Marketplace activity and earnings are loaded for this creator profile.
        </div>
      )}

      <section className="grid gap-8 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-8">
          <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 text-xs uppercase tracking-[0.3em] text-white/35">Revenue chart</div>
            <div className="h-72">
              <RevenueChart data={revenueSeries} />
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 text-xs uppercase tracking-[0.3em] text-white/35">Usage chart</div>
            <div className="h-72">
              <UsageChart data={revenueSeries} />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-white/35">Creator snapshot</div>
                <h2 className="mt-3 text-2xl font-semibold text-white">How your agents are performing</h2>
              </div>
              <div className="rounded-full border border-[#f7931a]/20 bg-[#f7931a]/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#f7b15a]">
                {agents.length} agents
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/35">Paid runs</div>
                <div className="mt-2 text-2xl font-semibold text-white">{history?.usageCount?.toLocaleString() ?? "0"}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/35">Recent payments</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {(history?.payments?.length ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/35">Wallet mode</div>
                <div className="mt-2 text-2xl font-semibold capitalize text-white">{mode}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/35">Marketplace view</div>
                <div className="mt-2 text-2xl font-semibold capitalize text-white">
                  {earnings?.source || history?.source || source}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-white/35">Market pulse</div>
                <h2 className="mt-3 text-2xl font-semibold text-white">What buyers are doing lately</h2>
              </div>
              <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-sky-200">
                {history?.activity?.length ?? 0} recent events
              </div>
            </div>

            <div className="space-y-3">
              {(history?.payments ?? []).slice(0, 4).map((payment) => (
                <div key={payment.id} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{payment.amount.toLocaleString()} sats payment</div>
                      <div className="mt-1 text-sm text-white/45">{payment.txHash}</div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">{payment.createdAt}</div>
                  </div>
                </div>
              ))}
              {(history?.payments?.length ?? 0) === 0 ? (
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm text-white/55">
                  Payment activity will show up here after users start running your agents.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 text-xs uppercase tracking-[0.3em] text-white/35">My agents</div>
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{agent.name}</div>
                      <div className="mt-1 text-sm text-white/45">
                        {agent.totalUses.toLocaleString()} runs · {agent.totalRevenue.toLocaleString()} sats
                      </div>
                    </div>
                    <button className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/65">Manage</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
            <div className="mb-5 text-xs uppercase tracking-[0.3em] text-white/35">Activity feed</div>
            <div className="space-y-4">
              {(history?.activity ?? []).map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{item.title}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">{item.timestamp}</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/62">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-screen max-w-7xl px-5 py-10 md:px-8" />}>
      <DashboardContent />
    </Suspense>
  );
}
