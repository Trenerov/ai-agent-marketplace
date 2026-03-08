import { NextRequest, NextResponse } from "next/server";
import { queryUserAgents } from "@/lib/agent-query";
import { resolveDataSourceMode } from "@/lib/data-source";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<unknown> }
) {
  const source = resolveDataSourceMode(req);
  const { addr } = (await params) as { addr: string };
  const agents = await queryUserAgents(source, decodeURIComponent(addr));

  return NextResponse.json({ source, agents });
}
