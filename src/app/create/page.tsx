"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ContractIntentNotice } from "@/components/ContractIntentNotice";
import { OperatingModeNotice } from "@/components/OperatingModeNotice";
import { useWallet } from "@/context/WalletContext";
import type { ContractActionEnvelope } from "@/lib/contract-intent";
import type { RuntimeOperationPolicy } from "@/lib/runtime-policy";
import { agentTemplates, categories } from "@/lib/site-data";

type FormState = {
  name: string;
  description: string;
  category: string;
  prompt: string;
  pricePerUse: number;
  royaltyBps: number;
};

const initialState: FormState = {
  name: "New Bitcoin Agent",
  description: "Monetize a specialized AI workflow on OP_NET.",
  category: "0",
  prompt: agentTemplates[0]?.prompt ?? "",
  pricePerUse: 500,
  royaltyBps: 500,
};

function CreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, connected, connect, contractsReady, network, mode } = useWallet();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);
  const [testResult, setTestResult] = useState("");
  const [error, setError] = useState("");
  const [contractIntent, setContractIntent] = useState<ContractActionEnvelope | null>(null);
  const [policy, setPolicy] = useState<RuntimeOperationPolicy | null>(null);
  const monthlyRevenue = useMemo(() => form.pricePerUse * 30 * 20, [form.pricePerUse]);
  const source = searchParams.get("source") || "overlay";

  const selectedCategory = categories.find((item) => item.id === Number(form.category));

  async function handleMint() {
    if (!address) {
      setError("Connect a wallet before minting.");
      return;
    }

    setSubmitting(true);
    setError("");
    setContractIntent(null);

    try {
      const response = await fetch(`/api/agents?${new URLSearchParams({ source }).toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category: Number(form.category),
          owner: address,
        }),
      });

      const data = (await response.json()) as
        | { mode?: "local"; agent?: { id: number }; error?: string; policy?: RuntimeOperationPolicy }
        | ContractActionEnvelope;

      if ("mode" in data && data.mode === "contract") {
        setContractIntent(data);
        setPolicy(data.policy ?? null);
        return;
      }

      setPolicy("policy" in data ? data.policy ?? null : null);

      if (!response.ok || !("agent" in data) || !data.agent) {
        throw new Error(data.error || "Mint failed");
      }

      router.push(`/agent/${data.agent.id}?source=${source}`);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Mint failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <div className="mb-8">
        <div className="mb-2 text-xs uppercase tracking-[0.34em] text-white/35">Create agent</div>
        <h1 className="text-4xl font-semibold text-white">4-step mint wizard</h1>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {["Basic Info", "Prompt", "Pricing", "Test and Mint"].map((label, index) => (
          <button
            key={label}
            onClick={() => setStep(index + 1)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              step === index + 1
                ? "bg-[#f7931a] text-black"
                : "border border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr,360px]">
        <section className="rounded-[34px] border border-white/10 bg-white/[0.03] p-7">
          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm text-white/60">Agent name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/60">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="min-h-40 w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/60">Category</label>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                {agentTemplates.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => setForm({ ...form, prompt: template.prompt })}
                    className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-left transition hover:border-[#f7931a]/30"
                  >
                    <div className="text-sm font-medium text-white">{template.name}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/35">{template.category}</div>
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/60">System prompt</label>
                <textarea
                  value={form.prompt}
                  onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                  className="min-h-60 w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
                <div className="mt-2 text-sm text-white/40">
                  {form.prompt.length} chars · uses {"{input}"} placeholder · source {source}
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm text-white/60">Price per use</label>
                <input
                  type="number"
                  value={form.pricePerUse}
                  onChange={(event) => setForm({ ...form, pricePerUse: Number(event.target.value) })}
                  className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/60">Royalty basis points</label>
                <input
                  type="number"
                  value={form.royaltyBps}
                  onChange={(event) => setForm({ ...form, royaltyBps: Number(event.target.value) })}
                  className="w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
              </div>
              <div className="rounded-[24px] border border-[#f7931a]/20 bg-[#f7931a]/8 p-5 text-sm text-[#f7b15a]">
                Revenue split: creator 85%, protocol 10%, referral 5%. Estimated monthly revenue at 20 paid runs/day:{" "}
                {monthlyRevenue.toLocaleString()} sats.
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-5 text-sm text-white/62">
                Mint mode: {contractsReady ? `contract-aware on ${network}` : "local MVP persistence"}. Wallet:{" "}
                {connected ? `${mode} (${address})` : "not connected"}.
              </div>
              <OperatingModeNotice source={source} contractsReady={contractsReady} policy={policy} />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-5">
              <button
                onClick={() => setTestResult(`Sample output for ${form.name}: concise, monetizable and category-aware.`)}
                className="rounded-full bg-[#f7931a] px-5 py-3 text-sm font-semibold text-black"
              >
                Run free test
              </button>
              {testResult ? (
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/72">
                  {testResult}
                </div>
              ) : null}
              <button
                onClick={() => void handleMint()}
                disabled={submitting}
                className="rounded-full border border-white/14 bg-white/5 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? "Minting..." : "Mint Agent on OP_NET"}
              </button>
              {!connected ? (
                <button
                  onClick={() => void connect()}
                  className="rounded-full bg-[#f7931a] px-5 py-3 text-sm font-semibold text-black"
                >
                  Connect wallet first
                </button>
              ) : null}
              {error ? <div className="text-sm text-red-400">{error}</div> : null}
              <ContractIntentNotice intent={contractIntent} />
            </div>
          ) : null}

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/65"
            >
              Back
            </button>
            <button
              onClick={() => setStep((current) => Math.min(4, current + 1))}
              className="rounded-full bg-[#f7931a] px-4 py-2 text-sm font-semibold text-black"
            >
              Next
            </button>
          </div>
        </section>

        <aside className="rounded-[34px] border border-white/10 bg-white/[0.03] p-7">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-white/35">Preview</div>
          <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.22),transparent_58%),rgba(0,0,0,0.18)] p-6">
            <div className="mb-4 inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/55">
              {selectedCategory?.name}
            </div>
            <h2 className="text-2xl font-semibold text-white">{form.name}</h2>
            <p className="mt-3 text-sm leading-6 text-white/62">{form.description}</p>
            <div className="mt-6 grid gap-3 text-sm">
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-white/40">Price</div>
                <div className="mt-1 font-semibold text-white">{form.pricePerUse} sats</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-white/40">Royalty</div>
                <div className="mt-1 font-semibold text-white">{form.royaltyBps / 100}%</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-screen max-w-6xl px-5 py-10 md:px-8" />}>
      <CreateContent />
    </Suspense>
  );
}
