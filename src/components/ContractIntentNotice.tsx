"use client";

import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import type {
  ContractActionEnvelope,
  ContractBroadcastResponse,
  ContractPrepareResponse,
  PreparedIntentPackage,
  PresignedBroadcastResponse,
  PresignedTransactionPackage,
} from "@/lib/contract-intent";
import { serializeIntentForSigning } from "@/lib/intent-signature";
import { signPreparedPackagesWithUnisat } from "@/lib/opnet-browser";

type Props = {
  intent: ContractActionEnvelope | null;
  onBroadcast?: (txIds: string[]) => void;
};

export function ContractIntentNotice({ intent, onBroadcast }: Props) {
  const { mode, signIntent, address } = useWallet();
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [broadcastingSigned, setBroadcastingSigned] = useState(false);
  const [signingPrepared, setSigningPrepared] = useState(false);
  const [error, setError] = useState("");
  const [txIds, setTxIds] = useState<string[]>([]);
  const [preparedPackages, setPreparedPackages] = useState<PreparedIntentPackage[]>([]);
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);
  const [signedPayload, setSignedPayload] = useState("");

  if (!intent) {
    return null;
  }

  const activeIntent = intent;

  async function handleBroadcast() {
    setLoading(true);
    setError("");
    setTxIds([]);

    try {
      const signer = mode === "injected" ? await signIntent(serializeIntentForSigning(activeIntent)) : null;
      const response = await fetch("/api/contracts/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...activeIntent,
          signer: signer
            ? {
                address,
                publicKey: signer.publicKey,
                signature: signer.signature,
              }
            : undefined,
        }),
      });
      const payload = (await response.json()) as ContractBroadcastResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Broadcast failed");
      }

      const nextTxIds = payload.receipts.map((receipt) => receipt.transactionId);
      setTxIds(nextTxIds);
      onBroadcast?.(nextTxIds);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Broadcast failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadPreparedPackage(preparedPackage: PreparedIntentPackage) {
    const bytes = Uint8Array.from(atob(preparedPackage.offlineBufferBase64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = preparedPackage.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handlePrepare() {
    if (!address) {
      setError("Connect a wallet before preparing an offline signing package.");
      return;
    }

    setPreparing(true);
    setError("");
    setPreparedPackages([]);
    setBlockedReasons([]);

    try {
      const signer = mode === "injected" ? await signIntent(serializeIntentForSigning(activeIntent)) : null;
      const response = await fetch("/api/contracts/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...activeIntent,
          signer: {
            address,
            publicKey: signer?.publicKey,
            signature: signer?.signature,
          },
        }),
      });
      const payload = (await response.json()) as ContractPrepareResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Offline preparation failed");
      }

      setPreparedPackages(payload.packages);
      setBlockedReasons(payload.blocked.map((entry) => `${entry.contractId}.${entry.method}: ${entry.reason}`));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Offline preparation failed");
    } finally {
      setPreparing(false);
    }
  }

  async function handleBroadcastSigned() {
    setBroadcastingSigned(true);
    setError("");
    setTxIds([]);

    try {
      const parsed = JSON.parse(signedPayload) as PresignedTransactionPackage | { packages: PresignedTransactionPackage[] };
      const packages = Array.isArray((parsed as { packages?: PresignedTransactionPackage[] }).packages)
        ? (parsed as { packages: PresignedTransactionPackage[] }).packages
        : [parsed as PresignedTransactionPackage];
      const response = await fetch("/api/contracts/broadcast-signed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages }),
      });
      const payload = (await response.json()) as PresignedBroadcastResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Signed broadcast failed");
      }

      const nextTxIds = payload.receipts.flatMap((receipt) =>
        [receipt.fundingTransactionId, receipt.interactionTransactionId].filter((txId): txId is string => Boolean(txId))
      );
      setTxIds(nextTxIds);
      onBroadcast?.(nextTxIds);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Signed broadcast failed");
    } finally {
      setBroadcastingSigned(false);
    }
  }

  async function handleSignPrepared() {
    setSigningPrepared(true);
    setError("");

    try {
      const signedPackages = await signPreparedPackagesWithUnisat(preparedPackages);
      setSignedPayload(JSON.stringify({ packages: signedPackages }, null, 2));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Browser signing failed");
    } finally {
      setSigningPrepared(false);
    }
  }

  async function handleSignAndBroadcast() {
    setSigningPrepared(true);
    setError("");
    setTxIds([]);

    try {
      const signedPackages = await signPreparedPackagesWithUnisat(preparedPackages);
      setSignedPayload(JSON.stringify({ packages: signedPackages }, null, 2));

      const response = await fetch("/api/contracts/broadcast-signed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages: signedPackages }),
      });
      const payload = (await response.json()) as PresignedBroadcastResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Signed broadcast failed");
      }

      const nextTxIds = payload.receipts.flatMap((receipt) =>
        [receipt.fundingTransactionId, receipt.interactionTransactionId].filter((txId): txId is string => Boolean(txId))
      );
      setTxIds(nextTxIds);
      onBroadcast?.(nextTxIds);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Browser signing failed");
    } finally {
      setSigningPrepared(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-[#f7931a]/20 bg-[#f7931a]/8 p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-[#f7b15a]">On-chain action required</div>
      <p className="mt-3 text-sm leading-6 text-white/72">{intent.message}</p>
      {intent.policy ? (
        <div className="mt-3 rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {intent.policy.operation}: {intent.policy.writeTarget}. {intent.policy.reason}
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        {intent.intents.map((step) => (
          <div key={`${step.contractId}-${step.method}`} className="rounded-[20px] border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-white">
                  {step.contractId}.{step.method}
                </div>
                <div className="mt-1 text-sm text-white/45">{step.description}</div>
              </div>
              <div className="text-right text-xs uppercase tracking-[0.18em] text-white/45">
                <div>{step.address}</div>
                {step.valueSats !== undefined ? <div className="mt-1">{step.valueSats.toLocaleString()} sats</div> : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {step.args.map((arg) => (
                <span key={`${step.method}-${arg.name}`} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  {arg.name}: {String(arg.value)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void handleBroadcast()}
          disabled={loading}
          className="rounded-full bg-[#f7931a] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Broadcasting..." : "Broadcast intent"}
        </button>
        <button
          onClick={() => void handlePrepare()}
          disabled={preparing}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {preparing ? "Preparing..." : "Prepare offline package"}
        </button>
        <div className="text-sm text-white/55">
          {mode === "injected"
            ? "Injected wallets sign the intent before server broadcast or offline package preparation."
            : "Sequential intents are resolved server-side during broadcast."}
        </div>
      </div>
      {preparedPackages.length > 0 ? (
        <div className="mt-4 rounded-[20px] border border-sky-500/20 bg-sky-500/10 p-4">
          <div className="text-sm font-medium text-sky-200">Offline signing packages</div>
          <div className="mt-3 space-y-3">
            {preparedPackages.map((preparedPackage) => (
              <div
                key={`${preparedPackage.contractId}-${preparedPackage.method}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-black/20 p-3"
              >
                <div className="text-sm text-white/72">
                  {preparedPackage.contractId}.{preparedPackage.method} · {preparedPackage.requiredSats.toLocaleString()} sats
                </div>
                <button
                  onClick={() => downloadPreparedPackage(preparedPackage)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black"
                >
                  Download {preparedPackage.filename}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {preparedPackages.length > 0 ? (
        <div className="mt-4 rounded-[20px] border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-medium text-white">Broadcast signed payload</div>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Paste the signed JSON returned by your offline signer. Expected fields: `contractId`, `method`,
            `interactionTransactionRaw`, optional `fundingTransactionRaw`.
          </p>
          <textarea
            value={signedPayload}
            onChange={(event) => setSignedPayload(event.target.value)}
            placeholder='{"contractId":"usagePayment","method":"pay","interactionTransactionRaw":"0200..."}'
            className="mt-3 min-h-40 w-full rounded-[18px] border border-white/10 bg-[#050816] p-4 text-sm text-white outline-none placeholder:text-white/25"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {mode === "injected" ? (
              <button
                onClick={() => void handleSignPrepared()}
                disabled={signingPrepared}
                className="rounded-full border border-sky-300/30 px-4 py-2 text-sm font-semibold text-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingPrepared ? "Signing..." : "Sign with Unisat"}
              </button>
            ) : null}
            {mode === "injected" ? (
              <button
                onClick={() => void handleSignAndBroadcast()}
                disabled={signingPrepared}
                className="rounded-full bg-sky-200 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingPrepared ? "Signing..." : "Sign and broadcast"}
              </button>
            ) : null}
            <button
              onClick={() => void handleBroadcastSigned()}
              disabled={broadcastingSigned || signingPrepared || signedPayload.trim() === ""}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {broadcastingSigned ? "Broadcasting signed tx..." : "Broadcast signed tx"}
            </button>
            <div className="text-sm text-white/45">
              This path broadcasts client-signed raw transactions and does not use the server mnemonic.
            </div>
          </div>
        </div>
      ) : null}
      {blockedReasons.length > 0 ? (
        <div className="mt-4 rounded-[20px] border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          {blockedReasons.map((reason) => (
            <div key={reason}>{reason}</div>
          ))}
        </div>
      ) : null}
      {txIds.length > 0 ? (
        <div className="mt-4 rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {txIds.map((txId) => (
            <div key={txId}>{txId}</div>
          ))}
        </div>
      ) : null}
      {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}
    </div>
  );
}
