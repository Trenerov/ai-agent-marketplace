"use client";

import type { RuntimeOperationPolicy } from "@/lib/runtime-policy";

type Props = {
  source: string;
  contractsReady: boolean;
  policy?: RuntimeOperationPolicy | null;
};

export function OperatingModeNotice({ source, contractsReady, policy }: Props) {
  const tone =
    policy?.status === "blocked"
      ? "border-red-500/20 bg-red-500/10 text-red-200"
      : policy?.writeTarget === "opnet-contracts"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-white/65";

  return (
    <div className={`rounded-[24px] border p-4 text-sm ${tone}`}>
      <div className="text-xs uppercase tracking-[0.2em]">
        runtime: {contractsReady ? "contract-aware" : "local fallback"} · source: {source}
      </div>
      <div className="mt-2 leading-6">
        {policy
          ? `${policy.operation}: ${policy.writeTarget}. ${policy.reason}`
          : "Read mode is active. Write actions resolve to local store, OP_NET contracts, or a read-only block depending on contract readiness."}
      </div>
    </div>
  );
}
