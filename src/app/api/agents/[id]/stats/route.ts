import { NextRequest, NextResponse } from "next/server";
import { queryAgentById } from "@/lib/agent-query";
import { resolveDataSourceMode } from "@/lib/data-source";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<unknown> }
) {
  const source = resolveDataSourceMode(req);
  const { id } = (await params) as { id: string };
  const agent = await queryAgentById(source, Number(id));

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({
    source,
    agentId: agent.id,
    totalUses: agent.totalUses,
    totalRevenue: agent.totalRevenue,
    avgRating: agent.avgRating,
    pricePerUse: agent.pricePerUse,
    isActive: agent.isActive,
    responseTime: agent.responseTime,
    chainSource: "chainSource" in agent ? agent.chainSource : "local",
    onChainMintTxId: "onChainMintTxId" in agent ? agent.onChainMintTxId ?? null : null,
    onChainLastPaymentTxId:
      "onChainLastPaymentTxId" in agent ? agent.onChainLastPaymentTxId ?? null : null,
  });
}
