import Link from "next/link";
import { ArrowRight, Shield, Sparkles } from "lucide-react";
import AgentCard from "@/components/AgentCard";
import { queryAgents } from "@/lib/agent-query";
import { getContractActivity } from "@/lib/contract-journal";
import { parseDataSourceMode } from "@/lib/data-source";
import { categories, valueProps } from "@/lib/site-data";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const source = parseDataSourceMode(resolvedParams?.source);
  const [allAgents, contractActivity] = await Promise.all([queryAgents(source), getContractActivity()]);
  const agents = allAgents.filter((agent) => agent.isActive);
  const overlayAgents = agents.filter((agent) => "chainSource" in agent && agent.chainSource !== "local");
  const stats = {
    totalAgents: agents.length,
    totalUses: agents.reduce((sum, agent) => sum + agent.totalUses, 0),
    totalRevenue: agents.reduce((sum, agent) => sum + agent.totalRevenue, 0),
    activeUsers: 1842,
    onChainBroadcasts: contractActivity.summary.totalBroadcasts,
    onChainMints: contractActivity.summary.mintedAgents,
    onChainListings: contractActivity.summary.activeListings,
    overlayAgents: overlayAgents.length,
  };
  const trendingAgents = [...agents].sort((a, b) => b.totalUses - a.totalUses).slice(0, 6);
  const marketplaceFlow = [
    {
      title: "Create and mint",
      description: "Launch an agent with encrypted prompt storage, pricing in sats and NFT ownership on OP_NET.",
    },
    {
      title: "Get paid per use",
      description: "Users pay only when they run the agent, while creators collect recurring revenue from executions.",
    },
    {
      title: "Sell successful agents",
      description: "High-performing agents can be listed on the secondary market with creator royalties preserved.",
    },
  ];
  const buyerReasons = [
    "Instant access to specialized Bitcoin-native AI tools",
    "Clear pricing before every execution",
    "Tradeable ownership instead of disposable prompts",
    "On-chain provenance for top-performing agents",
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(247,147,26,0.18),transparent_24%),linear-gradient(180deg,#0a0a0f_0%,#09090d_100%)]">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <section className="grid gap-8 rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-7 md:grid-cols-[1.1fr,0.9fr] md:p-10">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2 text-sm text-[#f7b15a]">
              <Sparkles size={16} />
              OP_NET Week 3 - The Breakthrough · {source}
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-7xl">
              Mint, trade and monetize AI agents on Bitcoin.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/62">
              First AI Agent Marketplace on Bitcoin. Creators earn from every execution, prompts stay encrypted, and
              successful agents can be sold on a secondary market with royalties enforced at the protocol layer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-full bg-[#f7931a] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#ff9f35]"
              >
                Explore agents
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/8"
              >
                Create agent
                <Shield size={16} />
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Total agents", value: stats.totalAgents.toString().padStart(2, "0") },
              { label: "Paid executions", value: stats.totalUses.toLocaleString() },
              { label: "Revenue", value: `${stats.totalRevenue.toLocaleString()} sats` },
              { label: "Active users", value: stats.activeUsers.toLocaleString() },
              { label: "On-chain broadcasts", value: stats.onChainBroadcasts.toLocaleString() },
              { label: "Overlay agents", value: stats.overlayAgents.toLocaleString() },
            ].map((item) => (
              <div key={item.label} className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="text-xs uppercase tracking-[0.28em] text-white/35">{item.label}</div>
                <div className="mt-4 text-3xl font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {valueProps.map((item) => (
            <div key={item.title} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#f7931a]">{item.title}</div>
              <p className="text-sm leading-6 text-white/62">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.34em] text-white/35">Trending agents</div>
              <h2 className="text-3xl font-semibold text-white">Top paid agents this week</h2>
              <p className="mt-3 text-sm text-white/50">
                On-chain now tracks {stats.onChainMints} mints and {stats.onChainListings} active listings through the local read model.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category.id}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/65"
                >
                  {category.name}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {trendingAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[32px] border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.34em] text-white/35">Explore</div>
              <h2 className="text-3xl font-semibold text-white">Seeded launch inventory from the specification</h2>
            </div>
            <div className="rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2 text-sm text-[#f7b15a]">
              6 launch agents
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} compact />
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[32px] border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.34em] text-white/35">How it works</div>
              <h2 className="text-3xl font-semibold text-white">A marketplace for monetizable AI agents</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
                The product is about launching, using and trading agents. The underlying stack matters only because it
                enables ownership, usage payments and royalties.
              </p>
            </div>
            <div className="rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2 text-sm text-[#f7b15a]">
              Built for creators and buyers
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {marketplaceFlow.map((step, index) => (
              <div key={step.title} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                <div className="mb-3 text-xs uppercase tracking-[0.24em] text-[#f7931a]">Step 0{index + 1}</div>
                <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/62">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-black/20 p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.24em] text-white/35">Why buyers care</div>
            <div className="grid gap-3 md:grid-cols-2">
              {buyerReasons.map((reason) => (
                <div key={reason} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/70">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
