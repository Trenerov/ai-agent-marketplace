import { NextRequest, NextResponse } from "next/server";
import { queryAgentById } from "@/lib/agent-query";
import { resolveDataSourceMode } from "@/lib/data-source";
import { runAgentExecution, validateExecutionRequest } from "@/lib/executor";
import { buildExecutionAction } from "@/lib/opnet-actions";
import { verifyUsagePayment } from "@/lib/payment-verifier";
import { createBlockedWritePolicy, createLocalWritePolicy } from "@/lib/runtime-policy";
import { executeAgent } from "@/lib/store";

export async function POST(req: NextRequest) {
  const source = resolveDataSourceMode(req);
  const body = (await req.json()) as {
    agentId?: number;
    userInput?: string;
    paymentTxId?: string;
    payer?: string;
  };

  if (!body.agentId || !body.userInput) {
    return NextResponse.json(
      { error: "Missing agentId or userInput" },
      { status: 400 }
    );
  }

  const agent = await queryAgentById(source, Number(body.agentId));
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (!agent.isActive) {
    return NextResponse.json({ error: "Agent is inactive" }, { status: 403 });
  }

  const guard = await validateExecutionRequest({
    agent,
    payer: body.payer,
    userInput: body.userInput,
  });

  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const contractAction = await buildExecutionAction({
    agentId: agent.id,
    userInput: body.userInput,
    amount: agent.pricePerUse,
    source,
  });

  if (contractAction && !body.paymentTxId) {
    return NextResponse.json(contractAction, { status: 202 });
  }

  if (!contractAction && source === "index") {
    return NextResponse.json(
      {
        error: "Execution is blocked in index mode until UsagePayment is frontend-ready.",
        policy: createBlockedWritePolicy("execute", source),
      },
      { status: 409 }
    );
  }

  if (contractAction && body.paymentTxId) {
    const verification = await verifyUsagePayment({
      paymentTxId: body.paymentTxId,
      agentId: agent.id,
      amount: agent.pricePerUse,
    });

    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.error || "Payment verification failed" },
        { status: 402 }
      );
    }
  }

  const runtimeResult = await runAgentExecution({
    agent,
    userInput: body.userInput,
  });

  if (runtimeResult.backendMode === "strict-unavailable") {
    return NextResponse.json(
      {
        error: runtimeResult.result,
        backendMode: runtimeResult.backendMode,
      },
      { status: 503 }
    );
  }

  const execution = await executeAgent({
    agentId: agent.id,
    userInput: body.userInput,
    paymentTxId: body.paymentTxId || `mock_tx_${Date.now()}`,
    payer: body.payer,
    result: runtimeResult.result,
    backendMode: runtimeResult.backendMode,
    provider: runtimeResult.provider,
    model: runtimeResult.model,
    latencyMs: runtimeResult.latencyMs,
    promptDigest: runtimeResult.promptDigest,
  });

  if (!execution) {
    return NextResponse.json({ error: "Execution failed" }, { status: 500 });
  }

  return NextResponse.json({
    mode: "local",
    source,
    policy: createLocalWritePolicy("execute", source),
    executionId: execution.id,
    agentId: execution.agentId,
    result: execution.result,
    cost: execution.cost,
    paymentTxId: execution.paymentTxId,
    backendMode: execution.backendMode,
    provider: execution.provider,
    model: execution.model,
    latencyMs: execution.latencyMs,
    promptDigest: execution.promptDigest,
    timestamp: execution.completedAt,
    status: execution.status,
  });
}
