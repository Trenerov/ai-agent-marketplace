"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ContractActivityCard } from "@/components/ContractActivityCard";
import { ContractStatusCard } from "@/components/ContractStatusCard";
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
  const [tab, setTab] = useState("agents");
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

      const agentsData = (await agentsResponse.json()) as { source?: string; agents?: DashboardAgent[] };
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
          Active wallet mode: {mode}. Dashboard data is resolved for {address} from {earnings?.source || history?.source || source}.
        </div>
      )}

      <div className="mb-8 flex flex-wrap gap-2">
        {[
          ["agents", "My Agents"],
          ["earnings", "Earnings"],
          ["activity", "Activity"],
          ["usage", "My Usage"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              tab === value
                ? "bg-[#f7931a] text-black"
                : "border border-white/10 bg-white/[0.03] text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
          <ContractStatusCard />
          <ContractActivityCard />

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
