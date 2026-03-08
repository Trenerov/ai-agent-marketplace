import { NextRequest, NextResponse } from "next/server";
import { queryAgents, queryListings } from "@/lib/agent-query";
import { resolveDataSourceMode } from "@/lib/data-source";
import { buildListingAction } from "@/lib/opnet-actions";
import { createBlockedWritePolicy, createLocalWritePolicy } from "@/lib/runtime-policy";
import { createListing } from "@/lib/store";

export async function GET(req: NextRequest) {
  const source = resolveDataSourceMode(req);
  const [listings, agents] = await Promise.all([queryListings(source), queryAgents(source)]);

  return NextResponse.json({
    source,
    listings: listings.map((listing) => ({
      ...listing,
      agent: agents.find((agent) => agent.id === listing.agentId) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const source = resolveDataSourceMode(req);
  const body = (await req.json()) as {
    agentId?: number;
    price?: number;
    seller?: string;
  };

  if (!body.agentId || !body.price || !body.seller) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const contractAction = await buildListingAction({
    agentId: body.agentId,
    price: body.price,
    source,
  });

  if (contractAction) {
    return NextResponse.json(contractAction, { status: 202 });
  }

  if (source === "index") {
    return NextResponse.json(
      {
        error: "Listing is blocked in index mode until Marketplace is frontend-ready.",
        policy: createBlockedWritePolicy("list", source),
      },
      { status: 409 }
    );
  }

  const listing = await createListing({
    agentId: body.agentId,
    price: body.price,
    seller: body.seller,
  });

  return NextResponse.json(
    { mode: "local", source, policy: createLocalWritePolicy("list", source), listing },
    { status: 201 }
  );
}
