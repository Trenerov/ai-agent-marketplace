import { NextResponse } from "next/server";
import { getContractIndexedState } from "@/lib/contract-query";

export async function GET() {
  const payload = await getContractIndexedState();
  return NextResponse.json(payload);
}
