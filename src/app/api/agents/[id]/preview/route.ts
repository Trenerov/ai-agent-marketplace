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
    id: agent.id,
    name: agent.name,
    description: agent.description,
    sample: agent.sampleOutputs[0] ?? null,
    pricePerUse: agent.pricePerUse,
    chainSource: "chainSource" in agent ? agent.chainSource : "local",
    metadataUri: agent.metadataUri,
  });
}
