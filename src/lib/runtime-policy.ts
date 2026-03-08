import type { DataSourceMode } from "@/lib/data-source";

export type RuntimeWriteTarget = "local-store" | "opnet-contracts" | "read-only";

export type RuntimeOperationPolicy = {
  operation: "mint" | "list" | "buy" | "execute";
  source: DataSourceMode;
  writeTarget: RuntimeWriteTarget;
  status: "available" | "blocked";
  reason: string;
};

export function createContractWritePolicy(
  operation: RuntimeOperationPolicy["operation"],
  source: DataSourceMode
): RuntimeOperationPolicy {
  return {
    operation,
    source,
    writeTarget: "opnet-contracts",
    status: "available",
    reason: "Contracts are configured for this operation, so writes are executed on OP_NET.",
  };
}

export function createLocalWritePolicy(
  operation: RuntimeOperationPolicy["operation"],
  source: DataSourceMode
): RuntimeOperationPolicy {
  return {
    operation,
    source,
    writeTarget: "local-store",
    status: "available",
    reason: "Contracts are not ready for this operation, so writes fall back to the local persistent store.",
  };
}

export function createBlockedWritePolicy(
  operation: RuntimeOperationPolicy["operation"],
  source: DataSourceMode
): RuntimeOperationPolicy {
  return {
    operation,
    source,
    writeTarget: "read-only",
    status: "blocked",
    reason: "Index mode is read-only until the matching contracts are deployed and frontend-ready.",
  };
}
