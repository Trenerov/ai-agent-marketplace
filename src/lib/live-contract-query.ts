import "server-only";

import { spawn } from "node:child_process";
import { getOpnetScriptPath, getOpnetWorkdir } from "@/lib/opnet-script-path";

export type LiveContractState = {
  agents: Array<Record<string, unknown>>;
  listings: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
};

function shouldUseLiveReads() {
  return process.env.OPNET_LIVE_READS === "1";
}

export async function getLiveContractState() {
  if (!shouldUseLiveReads()) {
    return null;
  }

  const scriptPath = getOpnetScriptPath("read-live-state.mjs");

  return new Promise<LiveContractState | null>((resolve, reject) => {
    const child = spawn("node", [scriptPath], {
      cwd: getOpnetWorkdir(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
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
      if (code !== 0) {
        reject(new Error(stderr || stdout || `read-live-state exited with code ${code}`));
        return;
      }

      try {
        const payload = JSON.parse(stdout) as {
          ok?: boolean;
          agents?: Array<Record<string, unknown>>;
          listings?: Array<Record<string, unknown>>;
          summary?: Record<string, unknown>;
          error?: string;
        };

        if (!payload.ok) {
          reject(new Error(payload.error || "Live read failed"));
          return;
        }

        resolve({
          agents: payload.agents || [],
          listings: payload.listings || [],
          summary: payload.summary || {},
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}
