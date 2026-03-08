import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Clock3, ShieldCheck, Star, Wallet } from "lucide-react";
import AgentActions from "@/components/AgentActions";
import { queryAgentById, queryListingByAgentId } from "@/lib/agent-query";
import { parseDataSourceMode } from "@/lib/data-source";
import { getCategoryById } from "@/lib/site-data";

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ source?: string }>;
}) {
  const { id } = await params;
  const resolvedParams = searchParams ? await searchParams : {};
  const source = parseDataSourceMode(resolvedParams?.source);
  const agent = await queryAgentById(source, Number(id));

  if (!agent) {
    notFound();
  }

  const listing = await queryListingByAgentId(source, agent.id);
  const protocolItems = [
    { label: "Prompt hash", value: agent.promptHash },
    { label: "Metadata URI", value: agent.metadataUri },
    { label: "Owner", value: agent.owner },
    { label: "Royalty", value: `${agent.royaltyBps / 100}%` },
    { label: "Status", value: agent.isActive ? "Active" : "Inactive" },
    ...("onChainMintTxId" in agent && agent.onChainMintTxId ? [{ label: "Mint tx", value: agent.onChainMintTxId }] : []),
    ...("onChainLastPaymentTxId" in agent && agent.onChainLastPaymentTxId
      ? [{ label: "Last payment tx", value: agent.onChainLastPaymentTxId }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <section className="grid gap-8 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-7 md:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex h-18 w-18 items-center justify-center rounded-[28px] border border-[#f7931a]/30 bg-[#f7931a]/10 font-mono text-2xl font-bold text-[#f7931a]">
              {agent.icon}
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.28em] text-white/35">
                {getCategoryById(agent.category)?.name}
              </div>
              <h1 className="text-4xl font-semibold text-white">{agent.name}</h1>
              <div className="mt-2 text-sm text-white/55">
                Creator {agent.creator} · Created {agent.createdAt} · {source}
              </div>
              {"chainSource" in agent && agent.chainSource !== "local" ? (
                <div className="mt-3 inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-200">
                  on-chain overlay
                </div>
              ) : null}
            </div>
          </div>

          <p className="max-w-3xl text-lg leading-8 text-white/62">{agent.description}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-white/40">
                <Star size={15} />
                Rating
              </div>
              <div className="text-2xl font-semibold text-white">{agent.avgRating.toFixed(1)}</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-white/40">
                <Wallet size={15} />
                Revenue
              </div>
              <div className="text-2xl font-semibold text-white">{agent.totalRevenue.toLocaleString()} sats</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-white/40">
                <ShieldCheck size={15} />
                Price
              </div>
              <div className="text-2xl font-semibold text-white">{agent.pricePerUse} sats</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="mb-2 flex items-center gap-2 text-white/40">
                <Clock3 size={15} />
                Avg time
              </div>
              <div className="text-2xl font-semibold text-white">{agent.responseTime}</div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/agent/${agent.id}/play?source=${source}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#f7931a] px-5 py-3 text-sm font-semibold text-black"
            >
              Use agent
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <AgentActions agentId={agent.id} listing={listing ?? null} />
        </div>

        <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-7 md:p-8">
          <div className="text-xs uppercase tracking-[0.3em] text-white/35">Protocol details</div>
          <div className="mt-5 space-y-4">
            {protocolItems.map((item) => (
              <div key={item.label} className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/35">{item.label}</div>
                <div className="mt-2 text-sm text-white/78">{String(item.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[1fr,0.95fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7">
          <div className="mb-5 text-xs uppercase tracking-[0.3em] text-white/35">Sample outputs</div>
          <div className="space-y-4">
            {agent.sampleOutputs.map((sample) => (
              <div key={sample.input} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                <div className="mb-3 text-sm font-medium text-[#f7931a]">Input</div>
                <p className="text-sm leading-6 text-white/75">{sample.input}</p>
                <div className="mb-3 mt-5 text-sm font-medium text-white">Output</div>
                <p className="text-sm leading-6 text-white/62">{sample.output}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7">
            <div className="mb-5 text-xs uppercase tracking-[0.3em] text-white/35">Reviews</div>
            <div className="space-y-4">
              {agent.reviews.map((review) => (
                <div key={review.user} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white">{review.user}</div>
                    <div className="text-sm text-[#f7931a]">{review.rating.toFixed(1)} / 5</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/62">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-7">
            <div className="mb-5 text-xs uppercase tracking-[0.3em] text-white/35">Usage history</div>
            <div className="space-y-3">
              {agent.usageHistory.map((entry) => (
                <div
                  key={entry.txHash}
                  className="grid grid-cols-[1fr,auto,auto] gap-3 rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm"
                >
                  <div>
                    <div className="text-white/78">{entry.payer}</div>
                    <div className="mt-1 text-white/35">{entry.txHash}</div>
                  </div>
                  <div className="font-medium text-white">{entry.amount} sats</div>
                  <div className="text-white/45">{entry.createdAt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
