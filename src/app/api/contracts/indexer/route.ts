import { NextResponse } from "next/server";
import { getContractIndexStatus, syncContractIndex } from "@/lib/contract-indexer";

export async function GET() {
  const status = await getContractIndexStatus();
  return NextResponse.json(status);
}

export async function POST() {
  const status = await syncContractIndex();
  return NextResponse.json(status);
}
