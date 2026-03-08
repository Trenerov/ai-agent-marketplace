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

  const message = policy
    ? policy.reason
    : contractsReady
      ? `Live marketplace data is available for this view${source === "index" ? ", including indexed activity." : "."}`
      : "You can browse and test the marketplace flow here while live contract actions continue to roll out.";

  return (
    <div className={`rounded-[24px] border p-4 text-sm ${tone}`}>
      <div className="text-xs uppercase tracking-[0.2em]">{contractsReady ? "Marketplace status" : "Demo mode"}</div>
      <div className="mt-2 leading-6">{message}</div>
    </div>
  );
}
