import { spawn } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { recordPresignedBroadcast } from "@/lib/contract-journal";
import type { PresignedBroadcastResponse, PresignedTransactionPackage } from "@/lib/contract-intent";

function runBroadcastSignedScript(scriptPath: string, packages: PresignedTransactionPackage[]) {
  return new Promise<PresignedBroadcastResponse>((resolve, reject) => {
    const child = spawn("node", [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      const raw = stdout || stderr;

      try {
        const parsed = JSON.parse(raw) as PresignedBroadcastResponse;

        if (code === 0) {
          resolve(parsed);
          return;
        }

        reject(parsed);
      } catch {
        reject(new Error(raw || `Signed broadcast script exited with code ${code ?? "unknown"}`));
      }
    });

    child.stdin.write(JSON.stringify({ packages }));
    child.stdin.end();
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { packages?: PresignedTransactionPackage[] };

  if (!Array.isArray(body?.packages) || body.packages.length === 0) {
    return NextResponse.json(
      { ok: false, receipts: [], error: "Missing signed packages" },
      { status: 400 }
    );
  }

  const scriptPath = path.join(process.cwd(), "contracts", "opnet", "scripts", "broadcast-signed.mjs");

  try {
    const payload = await runBroadcastSignedScript(scriptPath, body.packages);
    if (payload.ok) {
      await recordPresignedBroadcast(body.packages, payload.receipts);
    }
    return NextResponse.json(payload);
  } catch (error) {
    if (error && typeof error === "object" && "ok" in error) {
      return NextResponse.json(error, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: false,
        receipts: [],
        error: error instanceof Error ? error.message : "Signed broadcast failed",
      } satisfies PresignedBroadcastResponse,
      { status: 500 }
    );
  }
}
