import "server-only";

import { spawn } from "node:child_process";
import { getOpnetScriptPath } from "@/lib/opnet-script-path";

type IntentVerificationPayload = {
  message: string;
  publicKey: string;
  signature: string;
};

type IntentVerificationResult = {
  ok: boolean;
  error?: string;
};

function runVerificationScript(payload: IntentVerificationPayload) {
  const scriptPath = getOpnetScriptPath("verify-intent-signature.mjs");

  return new Promise<IntentVerificationResult>((resolve, reject) => {
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
        const parsed = JSON.parse(raw) as IntentVerificationResult;

        if (code === 0) {
          resolve(parsed);
          return;
        }

        reject(parsed);
      } catch {
        reject(new Error(raw || `Intent verification exited with code ${code ?? "unknown"}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function verifyIntentSignature(payload: IntentVerificationPayload) {
  try {
    return await runVerificationScript(payload);
  } catch (error) {
    if (error && typeof error === "object" && "ok" in error) {
      return error as IntentVerificationResult;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Intent verification failed",
    } satisfies IntentVerificationResult;
  }
}
