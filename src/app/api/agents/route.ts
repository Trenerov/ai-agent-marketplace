import { NextRequest, NextResponse } from "next/server";
import { queryAgents } from "@/lib/agent-query";
import { resolveDataSourceMode } from "@/lib/data-source";
import { buildMintAction } from "@/lib/opnet-actions";
import { createBlockedWritePolicy, createLocalWritePolicy } from "@/lib/runtime-policy";
import { createAgent } from "@/lib/store";

export async function GET(req: NextRequest) {
  const source = resolveDataSourceMode(req);
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") || "uses";
  const limit = Number(searchParams.get("limit") || 20);
  const offset = Number(searchParams.get("offset") || 0);

  let agents = (await queryAgents(source)).filter((agent) => agent.isActive);

  if (category !== null && category !== "") {
    agents = agents.filter((agent) => agent.category === Number(category));
  }

  if (q) {
    const query = q.toLowerCase();
    agents = agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query)
    );
  }

  switch (sort) {
    case "revenue":
      agents.sort((a, b) => b.totalRevenue - a.totalRevenue);
      break;
    case "rating":
      agents.sort((a, b) => b.avgRating - a.avgRating);
      break;
    case "newest":
      agents.sort((a, b) => b.id - a.id);
      break;
    case "cheapest":
      agents.sort((a, b) => a.pricePerUse - b.pricePerUse);
      break;
    default:
      agents.sort((a, b) => b.totalUses - a.totalUses);
  }

  const paginated = agents.slice(offset, offset + limit);

  return NextResponse.json({
    source,
    agents: paginated,
    total: agents.length,
    offset,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const source = resolveDataSourceMode(req);
  const body = (await req.json()) as {
    name?: string;
    description?: string;
    category?: number;
    prompt?: string;
    pricePerUse?: number;
    royaltyBps?: number;
    owner?: string;
  };

  if (!body.name || !body.description || body.category === undefined || !body.prompt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const contractAction = await buildMintAction({
    name: body.name,
    category: body.category,
    prompt: body.prompt,
    pricePerUse: body.pricePerUse ?? 500,
    royaltyBps: body.royaltyBps ?? 500,
    source,
  });

  if (contractAction) {
    return NextResponse.json(contractAction, { status: 202 });
  }

  if (source === "index") {
    return NextResponse.json(
      {
        error: "Mint is blocked in index mode until AgentNFT is frontend-ready.",
        policy: createBlockedWritePolicy("mint", source),
      },
      { status: 409 }
    );
  }

  const agent = await createAgent({
    name: body.name,
    description: body.description,
    category: body.category,
    prompt: body.prompt,
    pricePerUse: body.pricePerUse ?? 500,
    royaltyBps: body.royaltyBps ?? 500,
    owner: body.owner,
  });

  return NextResponse.json({ mode: "local", source, policy: createLocalWritePolicy("mint", source), agent }, { status: 201 });
}
