"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LoaderCircle, Send } from "lucide-react";
import { ContractIntentNotice } from "@/components/ContractIntentNotice";
import { useWallet } from "@/context/WalletContext";
import type { ContractActionEnvelope } from "@/lib/contract-intent";

type AgentPayload = {
  id: number;
  name: string;
  description: string;
  pricePerUse: number;
};

type Message = {
  role: "user" | "agent";
  text: string;
};

type ExecuteOutcome = "contract" | "executed" | "failed";

function PlaygroundContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { address, connected, connect, contractsReady, mode } = useWallet();
  const [agent, setAgent] = useState<AgentPayload | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contractIntent, setContractIntent] = useState<ContractActionEnvelope | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const source = searchParams.get("source") || "overlay";

  async function executeWithPayment(prompt: string, paymentTxId?: string): Promise<ExecuteOutcome> {
    if (!agent || !address) {
      return "failed";
    }

    const response = await fetch(`/api/execute?${new URLSearchParams({ source }).toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: agent.id,
        userInput: prompt,
        paymentTxId,
        payer: address,
      }),
    });

    const data = (await response.json()) as
      | { mode?: "local"; result?: string; error?: string }
      | ContractActionEnvelope;

    if ("mode" in data && data.mode === "contract") {
      setContractIntent(data);
      return "contract";
    }

    setMessages((current) => [
      ...current,
      {
        role: "agent",
        text: data.result ?? data.error ?? "Execution failed.",
      },
    ]);
    setContractIntent(null);
    setPendingPrompt("");
    return data.error ? "failed" : "executed";
  }

  useEffect(() => {
    let active = true;

    async function loadAgent() {
      setLoadingAgent(true);
      const response = await fetch(`/api/agents/${params.id}?${new URLSearchParams({ source }).toString()}`);
      const data = (await response.json()) as { agent?: AgentPayload };

      if (!active) {
        return;
      }

      if (!data.agent) {
        setAgent(null);
        setLoadingAgent(false);
        return;
      }

      setAgent(data.agent);
      setMessages([
        {
          role: "agent",
          text: `Ready to run ${data.agent.name}. Each execution costs ${data.agent.pricePerUse} sats.`,
        },
      ]);
      setLoadingAgent(false);
    }

    void loadAgent();

    return () => {
      active = false;
    };
  }, [params.id, source]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || !agent) {
      return;
    }

    if (!address) {
      setMessages((current) => [
        ...current,
        {
          role: "agent",
          text: "Connect a wallet before running this agent.",
        },
      ]);
      return;
    }

    const prompt = input.trim();
    setMessages((current) => [...current, { role: "user", text: prompt }]);
    setInput("");
    setLoading(true);
    setContractIntent(null);
    setPendingPrompt(prompt);

    try {
      const outcome = await executeWithPayment(prompt);
      if (outcome === "contract") {
        setMessages((current) => [
          ...current,
          {
            role: "agent",
            text: "Execution switched to on-chain mode. Broadcast the payment intent below to continue.",
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loadingAgent) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8">
        <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-10 text-white/60">
          Loading agent playground...
        </div>
      </div>
    );
  }

  if (!agent) {
    return <div className="mx-auto max-w-4xl px-5 py-10 text-white">Agent not found.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.34em] text-white/35">Agent playground</div>
          <h1 className="text-4xl font-semibold text-white">{agent.name}</h1>
          <p className="mt-3 max-w-2xl text-white/60">{agent.description}</p>
          <p className="mt-3 text-sm text-white/40">
            Mode: {contractsReady ? "contract-aware" : "local MVP"} · source: {source} · wallet:{" "}
            {connected ? `${mode} ${address}` : "disconnected"}
          </p>
        </div>
        <div className="rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-4 py-2 text-sm text-[#f7b15a]">
          This run costs {agent.pricePerUse} sats
        </div>
      </div>

      <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[88%] rounded-[28px] px-5 py-4 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-auto bg-[#f7931a] text-black"
                  : "border border-white/10 bg-black/20 text-white/72"
              }`}
            >
              {message.text}
            </div>
          ))}

          {loading ? (
            <div className="inline-flex items-center gap-3 rounded-[28px] border border-white/10 bg-black/20 px-5 py-4 text-sm text-white/62">
              <LoaderCircle className="animate-spin" size={16} />
              Agent is thinking...
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 md:flex-row">
          {!connected ? (
            <button
              type="button"
              onClick={() => void connect()}
              className="inline-flex items-center justify-center gap-2 rounded-[24px] bg-[#f7931a] px-5 py-4 text-sm font-semibold text-black md:w-44"
            >
              Connect wallet
            </button>
          ) : null}
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe the task for this agent..."
            className="min-h-28 flex-1 rounded-[24px] border border-white/10 bg-black/20 px-5 py-4 text-sm text-white outline-none placeholder:text-white/30"
          />
          <button
            type="submit"
            disabled={loading || !connected}
            className="inline-flex items-center justify-center gap-2 rounded-[24px] bg-[#f7931a] px-5 py-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60 md:w-44"
          >
            Run agent
            <Send size={16} />
          </button>
        </form>
        <div className="mt-4">
          <ContractIntentNotice
            intent={contractIntent}
            onBroadcast={(txIds) => {
              const paymentTxId = txIds[txIds.length - 1];
              if (!paymentTxId || !pendingPrompt) {
                return;
              }

              setMessages((current) => [
                ...current,
                {
                  role: "agent",
                  text: `Payment confirmed in tx ${paymentTxId}. Running execution...`,
                },
              ]);

              void executeWithPayment(pendingPrompt, paymentTxId);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-screen max-w-5xl px-5 py-10 md:px-8" />}>
      <PlaygroundContent />
    </Suspense>
  );
}
