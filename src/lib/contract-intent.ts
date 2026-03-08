export type IntentArgument = {
  name: string;
  type: string;
  value: string | number;
};

export type ContractCallIntent = {
  contractId: string;
  address: string;
  method: string;
  description: string;
  valueSats?: number;
  args: IntentArgument[];
};

export type ContractActionEnvelope = {
  mode: "contract";
  message: string;
  intents: ContractCallIntent[];
  policy?: import("@/lib/runtime-policy").RuntimeOperationPolicy;
};

export type PreparedIntentPackage = {
  contractId: string;
  method: string;
  description: string;
  address: string;
  valueSats: number;
  requiredSats: number;
  offlineBufferBase64: string;
  filename: string;
};

export type PresignedTransactionPackage = {
  contractId: string;
  method: string;
  fundingTransactionRaw?: string | null;
  interactionTransactionRaw: string;
};

export type BlockedIntent = {
  contractId: string;
  method: string;
  reason: string;
};

export type BroadcastReceipt = {
  contractId: string;
  method: string;
  transactionId: string;
  resolvedTokenId?: number;
};

export type ContractBroadcastResponse = {
  ok: boolean;
  receipts: BroadcastReceipt[];
  error?: string;
};

export type ContractPrepareResponse = {
  ok: boolean;
  packages: PreparedIntentPackage[];
  blocked: BlockedIntent[];
  error?: string;
};

export type PresignedBroadcastReceipt = {
  contractId: string;
  method: string;
  fundingTransactionId?: string;
  interactionTransactionId: string;
};

export type PresignedBroadcastResponse = {
  ok: boolean;
  receipts: PresignedBroadcastReceipt[];
  error?: string;
};
