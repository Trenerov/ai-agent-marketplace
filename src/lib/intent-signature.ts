import type { ContractActionEnvelope } from "@/lib/contract-intent";

function normalizeIntent(intent: ContractActionEnvelope) {
  return {
    version: 1,
    mode: intent.mode,
    message: intent.message,
    intents: intent.intents.map((entry) => ({
      contractId: entry.contractId,
      address: entry.address,
      method: entry.method,
      description: entry.description,
      valueSats: entry.valueSats ?? null,
      args: entry.args.map((arg) => ({
        name: arg.name,
        type: arg.type,
        value: String(arg.value),
      })),
    })),
  };
}

export function serializeIntentForSigning(intent: ContractActionEnvelope) {
  return `AI Agent Marketplace Intent\n${JSON.stringify(normalizeIntent(intent))}`;
}
