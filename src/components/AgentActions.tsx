"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ContractIntentNotice } from "@/components/ContractIntentNotice";
import { OperatingModeNotice } from "@/components/OperatingModeNotice";
import { useWallet } from "@/context/WalletContext";
import type { ContractActionEnvelope } from "@/lib/contract-intent";
import type { RuntimeOperationPolicy } from "@/lib/runtime-policy";

type Props = {
  agentId: number;
  listing: {
    id: number;
    price: number;
    seller: string;
    isActive: boolean;
  } | null;
};

export default function AgentActions({ agentId, listing }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, connected, connect, contractsReady, mode } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contractIntent, setContractIntent] = useState<ContractActionEnvelope | null>(null);
  const [policy, setPolicy] = useState<RuntimeOperationPolicy | null>(null);
  const source = searchParams.get("source") || "overlay";

  async function handleList() {
    if (!address) {
      setError("Connect a wallet before listing.");
      return;
    }

    setLoading(true);
    setError("");
    setContractIntent(null);

    try {
      const response = await fetch(`/api/marketplace/listings?${new URLSearchParams({ source }).toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          price: 250000,
          seller: address,
        }),
      });

      const data = (await response.json()) as
        | { mode?: "local"; listing?: { id: number }; error?: string; policy?: RuntimeOperationPolicy }
        | ContractActionEnvelope;

      if ("mode" in data && data.mode === "contract") {
        setContractIntent(data);
        setPolicy(data.policy ?? null);
        return;
      }

      setPolicy("policy" in data ? data.policy ?? null : null);

      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Failed to create listing");
      }

      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to create listing");
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy() {
    if (!listing) {
      return;
    }

    if (!address) {
      setError("Connect a wallet before buying.");
      return;
    }

    setLoading(true);
    setError("");
    setContractIntent(null);

    try {
      const response = await fetch(
        `/api/marketplace/listings/${listing.id}/buy?${new URLSearchParams({ source }).toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyer: address,
            amount: listing.price,
          }),
        }
      );

      const data = (await response.json()) as
        | ContractActionEnvelope
        | { error?: string; policy?: RuntimeOperationPolicy; mode?: "local" };

      if ("mode" in data && data.mode === "contract") {
        setContractIntent(data);
        setPolicy(data.policy ?? null);
        return;
      }

      setPolicy("policy" in data ? data.policy ?? null : null);

      if (!response.ok) {
        throw new Error(data.error || "Failed to buy listing");
      }

      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to buy listing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-3 text-sm text-white/45">
        Execution mode: {contractsReady ? "contract-aware" : "local MVP"} · wallet: {connected ? mode : "disconnected"}
      </div>
      <OperatingModeNotice source={source} contractsReady={contractsReady} policy={policy} />
      <div className="mt-3 flex flex-wrap gap-3">
        {!connected ? (
          <button
            onClick={() => void connect()}
            className="rounded-full bg-[#f7931a] px-5 py-3 text-sm font-semibold text-black"
          >
            Connect wallet
          </button>
        ) : null}
        <button
          onClick={listing ? handleBuy : handleList}
          disabled={loading || !connected}
          className="rounded-full border border-white/14 bg-white/5 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading
            ? "Processing..."
            : listing
              ? `Buy agent NFT for ${listing.price.toLocaleString()} sats`
              : "List agent for 250,000 sats"}
        </button>
      </div>
      <div className="mt-3">
        <ContractIntentNotice intent={contractIntent} />
      </div>
      {error ? <div className="mt-3 text-sm text-red-400">{error}</div> : null}
    </div>
  );
}
