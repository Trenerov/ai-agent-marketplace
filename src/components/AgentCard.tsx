import Link from "next/link";
import { ArrowUpRight, Star, Zap } from "lucide-react";
import { Agent, getCategoryById } from "@/lib/site-data";

export default function AgentCard({ agent, compact = false }: { agent: Agent; compact?: boolean }) {
  const category = getCategoryById(agent.category);

  return (
    <article className="group overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] transition hover:border-[#f7931a]/35 hover:shadow-[0_24px_80px_rgba(247,147,26,0.10)]">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.22),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(17,17,24,0.65))] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/12 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/65">
              {category?.name}
            </span>
            {"chainSource" in agent && agent.chainSource !== "local" ? (
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-200">
                on-chain
              </span>
            ) : null}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-black/30 font-mono text-sm font-bold text-[#f7931a]">
            {agent.icon}
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">{agent.name}</h3>
          <p className={`${compact ? "line-clamp-2" : "line-clamp-3"} text-sm leading-6 text-white/62`}>
            {agent.description}
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-white/45">
              <Zap size={14} />
              Uses
            </div>
            <div className="font-semibold text-white">{agent.totalUses.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-white/45">
              <Star size={14} />
              Rating
            </div>
            <div className="font-semibold text-white">{agent.avgRating.toFixed(1)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1 text-white/45">Price</div>
            <div className="font-semibold text-white">{agent.pricePerUse} sats</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">Creator</div>
            <div className="text-sm text-white/75">{agent.creator}</div>
          </div>
          <Link
            href={`/agent/${agent.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-[#f7931a] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#ff9f35]"
          >
            Use agent
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
