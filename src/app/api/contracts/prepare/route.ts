import { spawn } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { ContractActionEnvelope, ContractPrepareResponse } from "@/lib/contract-intent";
import { serializeIntentForSigning } from "@/lib/intent-signature";
import { verifyIntentSignature } from "@/lib/intent-verifier";

function runPrepareScript(
  scriptPath: string,
  payload: ContractActionEnvelope & {
    signer?: {
      address?: string;
      publicKey?: string;
      signature?: string;
    };
  }
) {
  return new Promise<ContractPrepareResponse>((resolve, reject) => {
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
        const parsed = JSON.parse(raw) as ContractPrepareResponse;

        if (code === 0) {
          resolve(parsed);
          return;
        }

        reject(parsed);
      } catch {
        reject(new Error(raw || `Prepare script exited with code ${code ?? "unknown"}`));
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
    return NextResponse.json(
      { ok: false, packages: [], blocked: [], error: "Missing intents" },
      { status: 400 }
    );
  }

  if (!body.signer?.address) {
    return NextResponse.json(
      { ok: false, packages: [], blocked: [], error: "Missing signer address" },
      { status: 400 }
    );
  }

  if (body.signer.publicKey && body.signer.signature) {
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
          packages: [],
          blocked: [],
          error: verification.error || "Intent signature verification failed",
        },
        { status: 401 }
      );
    }
  }

  const scriptPath = path.join(process.cwd(), "contracts", "opnet", "scripts", "prepare-intent.mjs");

  try {
    const payload = await runPrepareScript(scriptPath, body);
    return NextResponse.json(payload);
  } catch (error) {
    if (error && typeof error === "object" && "ok" in error) {
      return NextResponse.json(error, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: false,
        packages: [],
        blocked: [],
        error: error instanceof Error ? error.message : "Offline preparation failed",
      } satisfies ContractPrepareResponse,
      { status: 500 }
    );
  }
}
