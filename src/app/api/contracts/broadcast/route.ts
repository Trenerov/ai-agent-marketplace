import { spawn } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { recordIntentBroadcast } from "@/lib/contract-journal";
import type { ContractActionEnvelope, ContractBroadcastResponse } from "@/lib/contract-intent";
import { serializeIntentForSigning } from "@/lib/intent-signature";
import { verifyIntentSignature } from "@/lib/intent-verifier";

function runBroadcastScript(scriptPath: string, payload: ContractActionEnvelope) {
  return new Promise<ContractBroadcastResponse>((resolve, reject) => {
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
        const parsed = JSON.parse(raw) as ContractBroadcastResponse;

        if (code === 0) {
          resolve(parsed);
          return;
        }

        reject(parsed);
      } catch {
        reject(new Error(raw || `Broadcast script exited with code ${code ?? "unknown"}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ContractActionEnvelope & {
    signer?: {
      address?: string;
      publicKey?: string;
      signature?: string;
    };
  };

  if (!body?.intents || !Array.isArray(body.intents) || body.intents.length === 0) {
    return NextResponse.json({ ok: false, receipts: [], error: "Missing intents" }, { status: 400 });
  }

  if (body.signer?.publicKey && body.signer.signature) {
    const message = serializeIntentForSigning(body);
    const verification = await verifyIntentSignature({
      message,
      publicKey: body.signer.publicKey,
      signature: body.signer.signature,
    });

    if (!verification.ok) {
      return NextResponse.json(
        {
          ok: false,
          receipts: [],
          error: verification.error || "Intent signature verification failed",
        },
        { status: 401 }
      );
    }
  }

  const scriptPath = path.join(process.cwd(), "contracts", "opnet", "scripts", "broadcast-intent.mjs");

  try {
    const payload = await runBroadcastScript(scriptPath, body);
    if (payload.ok) {
      await recordIntentBroadcast(body, payload.receipts, "server-broadcast");
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
        error: error instanceof Error ? error.message : "Broadcast failed",
      } satisfies ContractBroadcastResponse,
      { status: 500 }
    );
  }
}
