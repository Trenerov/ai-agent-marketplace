import { NextRequest, NextResponse } from "next/server";
import { resolveDataSourceMode } from "@/lib/data-source";
import { buildBuyAction } from "@/lib/opnet-actions";
import { createBlockedWritePolicy, createLocalWritePolicy } from "@/lib/runtime-policy";
import { purchaseListing } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<unknown> }
) {
  const source = resolveDataSourceMode(req);
  const { id } = (await params) as { id: string };
  const body = (await req.json()) as { buyer?: string; amount?: number };

  if (!body.buyer) {
    return NextResponse.json({ error: "Missing buyer" }, { status: 400 });
  }

  const contractAction = await buildBuyAction({
    listingId: Number(id),
    amount: body.amount ?? 0,
    source,
  });

  if (contractAction) {
    return NextResponse.json(contractAction, { status: 202 });
  }

  if (source === "index") {
    return NextResponse.json(
      {
        error: "Buying is blocked in index mode until Marketplace is frontend-ready.",
        policy: createBlockedWritePolicy("buy", source),
      },
      { status: 409 }
    );
  }

  const result = await purchaseListing({
    listingId: Number(id),
    buyer: body.buyer,
  });

  if (!result) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  return NextResponse.json({ ...result, mode: "local", source, policy: createLocalWritePolicy("buy", source) });
}
