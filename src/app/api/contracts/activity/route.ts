import { NextResponse } from "next/server";
import { getContractActivity } from "@/lib/contract-journal";

export async function GET() {
  const activity = await getContractActivity();
  return NextResponse.json(activity);
}
