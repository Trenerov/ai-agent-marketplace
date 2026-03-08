import { NextRequest, NextResponse } from "next/server";
import { queryAgentById, queryListingByAgentId } from "@/lib/agent-query";
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

  const listing = await queryListingByAgentId(source, agent.id);

  return NextResponse.json({ source, agent, listing: listing ?? null });
}
