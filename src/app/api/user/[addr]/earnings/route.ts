import { NextRequest, NextResponse } from "next/server";
import { queryUserSummary } from "@/lib/agent-query";
import { resolveDataSourceMode } from "@/lib/data-source";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<unknown> }
) {
  const source = resolveDataSourceMode(req);
  const { addr } = (await params) as { addr: string };
  const summary = await queryUserSummary(source, decodeURIComponent(addr));

  return NextResponse.json({
    source,
    address: summary.address,
    totalEarned: summary.totalEarned,
    activeAgents: summary.agents.length,
  });
}
