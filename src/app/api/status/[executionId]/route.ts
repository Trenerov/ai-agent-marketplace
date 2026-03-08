import { NextRequest, NextResponse } from "next/server";
import { getExecutionById } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<unknown> }
) {
  const { executionId } = (await params) as { executionId: string };
  const execution = await getExecutionById(executionId);

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  return NextResponse.json({ execution });
}
