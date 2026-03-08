import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { queryAgents, queryListings } from "@/lib/agent-query";
import { parseDataSourceMode } from "@/lib/data-source";
import { getCategoryById } from "@/lib/site-data";

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const source = parseDataSourceMode(resolvedParams?.source);
  const [listings, agents] = await Promise.all([queryListings(source), queryAgents(source)]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.34em] text-white/35">Secondary market</div>
          <h1 className="text-4xl font-semibold text-white">Buy and sell agent NFTs</h1>
          <p className="mt-3 max-w-2xl text-white/60">
            Fixed-price listings for MVP, creator royalties enforced, and valuation informed by live usage and revenue.
          </p>
        </div>
        <div className="rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2 text-sm text-[#f7b15a]">
          Fixed-price MVP · {source}
        </div>
      </div>

      <section className="mb-8 grid gap-4 lg:grid-cols-4">
        {[
          { label: "Sort", value: "Most revenue" },
          { label: "Category", value: "All sectors" },
          { label: "Price range", value: "200k - 500k sats" },
          { label: "Min uses", value: "700+" },
        ].map((filter) => (
          <div key={filter.label} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-white/35">{filter.label}</div>
            <div className="mt-3 text-lg font-medium text-white">{filter.value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {listings.map((listing) => {
          const agent = agents.find((item) => item.id === listing.agentId);
          const onChainListingTxId =
            "onChainListingTxId" in listing && typeof listing.onChainListingTxId === "string"
              ? listing.onChainListingTxId
              : null;

          if (!agent) {
            return null;
          }

          return (
            <article key={listing.id} className="rounded-[30px] border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/55">
                  {getCategoryById(agent.category)?.name}
                </span>
                <div className="flex items-center gap-2">
                  {"chainSource" in listing && listing.chainSource !== "local" ? (
                    <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-200">
                      on-chain
                    </span>
                  ) : null}
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-[#f7931a]">
                    #{listing.id}
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-white">{agent.name}</h2>
              <p className="mt-3 text-sm leading-6 text-white/62">{agent.description}</p>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-white/40">Listing price</div>
                  <div className="mt-2 font-semibold text-white">{listing.price.toLocaleString()} sats</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-white/40">Revenue generated</div>
                  <div className="mt-2 font-semibold text-white">{agent.totalRevenue.toLocaleString()} sats</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-white/40">Paid runs</div>
                  <div className="mt-2 font-semibold text-white">{agent.totalUses.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-white/40">Royalty</div>
                  <div className="mt-2 font-semibold text-white">{agent.royaltyBps / 100}%</div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Seller</div>
                  <div className="text-sm text-white/72">{listing.seller}</div>
                  {onChainListingTxId ? <div className="mt-1 text-xs text-white/35">{onChainListingTxId}</div> : null}
                </div>
                <Link
                  href={`/agent/${agent.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f7931a] px-4 py-2 text-sm font-semibold text-black"
                >
                  View listing
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
