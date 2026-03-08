import type { PreparedIntentPackage, PresignedTransactionPackage } from "@/lib/contract-intent";

type BrowserCallResult = {
  signTransaction: (
    params: {
      signer: unknown;
      mldsaSigner: null;
      refundTo: string;
      maximumAllowedSatToSpend: bigint;
      network: unknown;
    },
    amountAddition?: bigint
  ) => Promise<{
    fundingTransactionRaw: string | null;
    interactionTransactionRaw: string;
  }>;
};

type BrowserCallResultCtor = {
  fromOfflineBuffer: (input: Uint8Array | string) => BrowserCallResult;
};

type BrowserUnisatSigner = {
  init: () => Promise<void>;
  p2tr: string;
  network: unknown;
};

type BrowserUnisatSignerCtor = new () => BrowserUnisatSigner;

function base64ToUint8Array(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function loadBrowserRuntime() {
  const [{ CallResult }, { UnisatSigner }] = await Promise.all([
    import("../../contracts/opnet/node_modules/opnet/browser/index.js"),
    import("../../contracts/opnet/node_modules/@btc-vision/transaction/browser/index.js"),
  ]);

  return {
    CallResult: CallResult as BrowserCallResultCtor,
    UnisatSigner: UnisatSigner as BrowserUnisatSignerCtor,
  };
}

export async function signPreparedPackagesWithUnisat(preparedPackages: PreparedIntentPackage[]) {
  if (typeof window === "undefined" || !window.unisat) {
    throw new Error("Unisat wallet is not available in this browser.");
  }

  const { CallResult, UnisatSigner } = await loadBrowserRuntime();
  const signer = new UnisatSigner();
  await signer.init();

  const signedPackages: PresignedTransactionPackage[] = [];

  for (const preparedPackage of preparedPackages) {
    const callResult = CallResult.fromOfflineBuffer(base64ToUint8Array(preparedPackage.offlineBufferBase64));
    const signed = await callResult.signTransaction(
      {
        signer,
        mldsaSigner: null,
        refundTo: signer.p2tr,
        maximumAllowedSatToSpend: BigInt(preparedPackage.requiredSats),
        network: signer.network,
      },
      BigInt(preparedPackage.valueSats)
    );

    signedPackages.push({
      contractId: preparedPackage.contractId,
      method: preparedPackage.method,
      fundingTransactionRaw: signed.fundingTransactionRaw,
      interactionTransactionRaw: signed.interactionTransactionRaw,
    });
  }

  return signedPackages;
}
