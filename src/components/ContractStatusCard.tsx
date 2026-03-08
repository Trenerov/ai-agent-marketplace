"use client";

import { useEffect, useState } from "react";
import type { ContractStatusPayload } from "@/lib/contracts";

export function ContractStatusCard() {
  const [status, setStatus] = useState<ContractStatusPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      const response = await fetch("/api/contracts/status");
      const payload = (await response.json()) as ContractStatusPayload;

      if (!active) {
        return;
      }

      setStatus(payload);
    }

    void loadStatus();

    return () => {
      active = false;
    };
  }, []);

  const readyContracts = status?.contracts.filter((entry) => entry.readyForFrontend).length ?? 0;
  const totalContracts = status?.contracts.length ?? 4;

  return (
    <div className="rounded-[34px] border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/35">Contracts</div>
          <h2 className="mt-3 text-2xl font-semibold text-white">OP_NET deployment readiness</h2>
        </div>
        <div className="rounded-full border border-[#f7931a]/20 bg-[#f7931a]/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#f7b15a]">
          {status?.network ?? "loading"}
        </div>
      </div>

      <div className="mb-5 text-sm text-white/45">
        RPC: {status?.rpcUrl ?? "not configured"}
        {status?.updatedAt ? ` · state updated ${new Date(status.updatedAt).toLocaleString()}` : ""}
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/35">ABI ready</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {status ? `${status.contracts.filter((entry) => entry.abiReady).length}/${totalContracts}` : "--"}
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/35">Deployed</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {status
              ? `${status.contracts.filter((entry) => entry.deployedAddress !== null).length}/${totalContracts}`
              : "--"}
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/35">Frontend-ready</div>
          <div className="mt-2 text-2xl font-semibold text-white">{`${readyContracts}/${totalContracts}`}</div>
        </div>
      </div>

      <div className="space-y-3">
        {(status?.contracts ?? []).map((entry) => (
          <div key={entry.id} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">{entry.id}</div>
                <div className="mt-1 text-sm text-white/45">
                  {entry.abiMethods.length} ABI methods · {entry.deployedAddress ?? "address missing"}
                </div>
                {entry.fundingTxId || entry.revealTxId ? (
                  <div className="mt-2 text-xs uppercase tracking-[0.15em] text-white/35">
                    {entry.fundingTxId ? `funding ${entry.fundingTxId}` : ""}
                    {entry.fundingTxId && entry.revealTxId ? " · " : ""}
                    {entry.revealTxId ? `reveal ${entry.revealTxId}` : ""}
                  </div>
                ) : null}
              </div>
              <div
                className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                  entry.readyForFrontend
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-white/8 text-white/55"
                }`}
              >
                {entry.readyForFrontend ? "ready" : "pending"}
              </div>
            </div>
            {entry.configure.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.configure.map((step) => (
                  <span
                    key={`${entry.id}-${step.method}`}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      step.satisfied
                        ? "border-emerald-500/25 text-emerald-300"
                        : "border-white/10 text-white/45"
                    }`}
                  >
                    {step.method}
                    {step.txId ? " done" : ""}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
