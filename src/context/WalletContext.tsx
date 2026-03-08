"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ContractStatusPayload } from "@/lib/contracts";
import { walletSummary } from "@/lib/site-data";

type WalletMode = "disconnected" | "demo" | "injected";

type InjectedWallet = {
  requestAccounts?: () => Promise<string[]>;
  getAccounts?: () => Promise<string[]>;
  getNetwork?: () => Promise<string>;
  getChain?: () => Promise<{ name?: string } | string>;
  getBalance?: () => Promise<{ confirmed?: number; total?: number } | number | string>;
  getPublicKey?: () => Promise<string>;
  signData?: (hex: string, type?: string, originalMessage?: string) => Promise<string>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type WalletContextValue = {
  connected: boolean;
  mode: WalletMode;
  walletAvailable: boolean;
  address: string | null;
  publicKey: string | null;
  network: string;
  balance: string;
  walletLabel: string;
  contractsReady: boolean;
  contractStatus: ContractStatusPayload | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signIntent: (message: string) => Promise<{ signature: string; publicKey: string } | null>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function getInjectedWallet(): InjectedWallet | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as Window & { unisat?: InjectedWallet }).unisat;
}

function formatBalance(balance: Awaited<ReturnType<NonNullable<InjectedWallet["getBalance"]>>>) {
  if (typeof balance === "number") {
    return `${balance.toLocaleString()} sats`;
  }

  if (typeof balance === "string") {
    return balance;
  }

  if (balance && typeof balance.confirmed === "number") {
    return `${balance.confirmed.toLocaleString()} sats`;
  }

  if (balance && typeof balance.total === "number") {
    return `${balance.total.toLocaleString()} sats`;
  }

  return walletSummary.balanceBtc;
}

async function getInjectedSnapshot(wallet: InjectedWallet) {
  const accounts =
    (wallet.getAccounts ? await wallet.getAccounts() : null) ??
    (wallet.requestAccounts ? await wallet.requestAccounts() : []);
  const address = accounts[0] ?? null;

  if (!address) {
    return null;
  }

  const [networkResult, balanceResult, publicKeyResult] = await Promise.all([
    wallet.getNetwork?.() ?? wallet.getChain?.(),
    wallet.getBalance?.(),
    wallet.getPublicKey?.(),
  ]);

  const network =
    typeof networkResult === "string"
      ? networkResult
      : typeof networkResult?.name === "string"
        ? networkResult.name
        : "Injected wallet";

  return {
    address,
    network,
    balance: balanceResult === undefined ? walletSummary.balanceBtc : formatBalance(balanceResult),
    publicKey: publicKeyResult ?? null,
  };
}

async function hashMessageHex(message: string) {
  const data = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<WalletMode>("disconnected");
  const [address, setAddress] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState(walletSummary.network);
  const [balance, setBalance] = useState("0 BTC");
  const [walletAvailable, setWalletAvailable] = useState(
    () => typeof window !== "undefined" && Boolean(getInjectedWallet())
  );
  const [contractStatus, setContractStatus] = useState<ContractStatusPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function loadContracts() {
      const response = await fetch("/api/contracts/status");
      const payload = (await response.json()) as ContractStatusPayload;

      if (!active) {
        return;
      }

      setContractStatus(payload);
      if (mode === "disconnected") {
        setNetwork(payload.network);
      }
    }

    void loadContracts();

    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    const wallet = getInjectedWallet();

    if (!wallet?.on) {
      return;
    }

    const syncAccounts = (nextAccounts: unknown) => {
      const accounts = Array.isArray(nextAccounts) ? nextAccounts : [];
      const nextAddress = typeof accounts[0] === "string" ? accounts[0] : null;

      if (nextAddress) {
        setMode("injected");
        setAddress(nextAddress);
      } else {
        setMode("disconnected");
        setAddress(null);
        setPublicKey(null);
        setBalance("0 BTC");
      }
    };

    const syncNetwork = (nextNetwork: unknown) => {
      if (typeof nextNetwork === "string" && nextNetwork.trim() !== "") {
        setNetwork(nextNetwork);
      }
    };

    wallet.on("accountsChanged", syncAccounts);
    wallet.on("networkChanged", syncNetwork);

    return () => {
      wallet.removeListener?.("accountsChanged", syncAccounts);
      wallet.removeListener?.("networkChanged", syncNetwork);
    };
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      connected: mode !== "disconnected",
      mode,
      walletAvailable,
      address,
      publicKey,
      network,
      balance,
      walletLabel: mode === "injected" ? "Injected wallet" : mode === "demo" ? "Demo wallet" : "Disconnected",
      contractsReady: contractStatus?.contracts.some((entry) => entry.readyForFrontend) ?? false,
      contractStatus,
      connect: async () => {
        const wallet = getInjectedWallet();

        if (wallet) {
          const snapshot = await getInjectedSnapshot(wallet);
          setWalletAvailable(true);

          if (snapshot) {
            setMode("injected");
            setAddress(snapshot.address);
            setPublicKey(snapshot.publicKey);
            setNetwork(snapshot.network);
            setBalance(snapshot.balance);
            return;
          }
        }

        setMode("demo");
        setAddress(walletSummary.address);
        setPublicKey(null);
        setNetwork(contractStatus?.network ?? walletSummary.network);
        setBalance(walletSummary.balanceBtc);
      },
      disconnect: () => {
        setMode("disconnected");
        setAddress(null);
        setPublicKey(null);
        setBalance("0 BTC");
        setNetwork(contractStatus?.network ?? walletSummary.network);
      },
      signIntent: async (message: string) => {
        const wallet = getInjectedWallet();

        if (!wallet?.signData || !wallet.getPublicKey || mode !== "injected") {
          return null;
        }

        const [messageHex, currentPublicKey] = await Promise.all([
          hashMessageHex(message),
          wallet.getPublicKey(),
        ]);
        const signature = await wallet.signData(messageHex, "schnorr", message);

        setPublicKey(currentPublicKey);
        return {
          signature,
          publicKey: currentPublicKey,
        };
      },
    }),
    [address, balance, contractStatus, mode, network, publicKey, walletAvailable]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }

  return context;
}
