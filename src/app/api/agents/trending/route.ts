import { NextRequest, NextResponse } from "next/server";
import { queryAgents } from "@/lib/agent-query";
import { resolveDataSourceMode } from "@/lib/data-source";

export async function GET(req: NextRequest) {
  const source = resolveDataSourceMode(req);
  const agents = await queryAgents(source);
  const trending = [...agents]
    .filter((agent) => agent.isActive)
    .sort((a, b) => b.totalUses - a.totalUses)
    .slice(0, 6);

  return NextResponse.json({
    source,
    agents: trending,
    overlayCount: trending.filter((agent) => "chainSource" in agent && agent.chainSource !== "local").length,
  });
}
