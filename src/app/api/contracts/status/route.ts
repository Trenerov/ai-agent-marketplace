import { NextResponse } from "next/server";
import { getContractStatus } from "@/lib/contracts";

export async function GET() {
  const status = await getContractStatus();
  return NextResponse.json(status);
}
