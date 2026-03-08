import "server-only";

import { spawn } from "node:child_process";
import { getOpnetScriptPath } from "@/lib/opnet-script-path";

type VerificationPayload = {
  paymentTxId: string;
  agentId: number;
  amount: number;
};

type VerificationResult = {
  ok: boolean;
  paymentTxId?: string;
  agentId?: string;
  amount?: string;
  error?: string;
};

function runScript(scriptName: string, payload: VerificationPayload) {
  const scriptPath = getOpnetScriptPath(scriptName);

  return new Promise<VerificationResult>((resolve, reject) => {
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
        const parsed = JSON.parse(raw) as VerificationResult;

        if (code === 0) {
          resolve(parsed);
          return;
        }

        reject(parsed);
      } catch {
        reject(new Error(raw || `Verification script exited with code ${code ?? "unknown"}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function verifyUsagePayment(payload: VerificationPayload) {
  try {
    const result = await runScript("verify-payment.mjs", payload);
    return result;
  } catch (error) {
    if (error && typeof error === "object" && "ok" in error) {
      return error as VerificationResult;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Payment verification failed",
    } satisfies VerificationResult;
  }
}
