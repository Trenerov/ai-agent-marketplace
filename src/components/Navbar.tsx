"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useWallet } from "@/context/WalletContext";

const navItems = [
  { href: "/", label: "Explore" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/create", label: "Create" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { connected, address, network, balance, connect, disconnect, walletAvailable, walletLabel, contractsReady } =
    useWallet();
  const source = searchParams.get("source") || "overlay";

  function buildHref(href: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("source", source);
    const query = params.toString();
    return query ? `${href}?${query}` : href;
  }

  function handleSourceChange(nextSource: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("source", nextSource);
    window.location.href = `${pathname}?${params.toString()}`;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(10,10,15,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4">
        <Link href={buildHref("/")} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#f7931a]/30 bg-[#f7931a]/10 text-sm font-black text-[#f7931a]">
            AI
          </div>
          <div>
            <div className="font-mono text-sm font-bold uppercase tracking-[0.32em] text-[#f7931a]">
              Agent Marketplace
            </div>
            <div className="text-xs text-white/45">First AI Agent Marketplace on Bitcoin</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={buildHref(item.href)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  active ? "bg-[#f7931a] text-black" : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right md:block">
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">
              {network} · {walletLabel}
            </div>
            <div className="text-sm font-medium text-white/85">{connected ? balance : "Wallet disconnected"}</div>
          </div>
          <label className="hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65 lg:flex lg:items-center lg:gap-2">
            <span className="uppercase tracking-[0.18em] text-white/40">source</span>
            <select
              value={source}
              onChange={(event) => handleSourceChange(event.target.value)}
              className="bg-transparent text-sm text-white outline-none"
            >
              <option value="local" className="bg-[#09090d]">
                local
              </option>
              <option value="overlay" className="bg-[#09090d]">
                overlay
              </option>
              <option value="index" className="bg-[#09090d]">
                index
              </option>
            </select>
          </label>
          <div
            className={`hidden rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] lg:block ${
              contractsReady ? "border-emerald-500/20 text-emerald-300" : "border-white/10 text-white/45"
            }`}
          >
            {contractsReady ? "contracts ready" : "local mode"} · {source}
          </div>
          {connected ? (
            <button
              onClick={disconnect}
              className="rounded-2xl border border-[#f7931a]/40 bg-[#f7931a]/12 px-4 py-2 text-sm font-medium text-[#f7931a] transition hover:bg-[#f7931a]/18"
            >
              {address}
            </button>
          ) : (
            <button
              onClick={() => void connect()}
              className="rounded-2xl bg-[#f7931a] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#ff9f35]"
            >
              {walletAvailable ? "Connect wallet" : "Use demo wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
