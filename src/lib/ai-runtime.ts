import "server-only";

import { createHash } from "node:crypto";
import { decryptPrompt } from "@/lib/crypto";
import type { Agent } from "@/lib/site-data";
import { readDb } from "@/lib/store";

const DEFAULT_MAX_INPUT_CHARS = 2000;
const DEFAULT_RATE_LIMIT_COUNT = 5;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

export type ExecutionGuardResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type RuntimeExecutionResult = {
  result: string;
  backendMode: "local-simulated" | "remote-http" | "strict-unavailable";
  provider: "local" | "openai-compatible" | "anthropic-compatible";
  model: string;
  latencyMs: number;
  promptDigest: string;
};

function getMaxInputChars() {
  return Number(process.env.AI_MAX_INPUT_CHARS || DEFAULT_MAX_INPUT_CHARS);
}

function getRateLimitCount() {
  return Number(process.env.AI_RATE_LIMIT_COUNT || DEFAULT_RATE_LIMIT_COUNT);
}

function getRateLimitWindowMs() {
  return Number(process.env.AI_RATE_LIMIT_WINDOW_MS || DEFAULT_RATE_LIMIT_WINDOW_MS);
}

function getRuntimeMode() {
  return process.env.AI_BACKEND_MODE || "local";
}

function getHttpProvider() {
  return process.env.AI_HTTP_PROVIDER || "openai";
}

function getHttpTimeoutMs() {
  return Number(process.env.AI_HTTP_TIMEOUT_MS || DEFAULT_HTTP_TIMEOUT_MS);
}

function getHttpConfig() {
  return {
    endpoint: process.env.AI_HTTP_ENDPOINT?.trim() || "",
    apiKey: process.env.AI_HTTP_API_KEY?.trim() || "",
    model: process.env.AI_HTTP_MODEL?.trim() || "",
    provider: getHttpProvider(),
    timeoutMs: getHttpTimeoutMs(),
  };
}

function buildLocalSimulatedResult(agent: Agent, userInput: string, systemPrompt: string) {
  const promptDigest = createHash("sha256").update(systemPrompt).digest("hex");
  const output = agent.sampleOutputs[0]?.output ?? "No sample output configured yet.";

  return [
    `Agent ${agent.name} executed successfully.`,
    `Input: ${userInput}`,
    `Prompt digest: ${promptDigest.slice(0, 16)}...`,
    `Execution backend: local simulated provider`,
    `Output: ${output}`,
  ].join("\n\n");
}

function buildMessages(systemPrompt: string, userInput: string) {
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userInput,
    },
  ];
}

async function callOpenAiCompatible(input: {
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  systemPrompt: string;
  userInput: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: buildMessages(input.systemPrompt, input.userInput),
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || `Remote provider failed with status ${response.status}`);
    }

    return payload.choices?.[0]?.message?.content?.trim() || "";
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropicCompatible(input: {
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  systemPrompt: string;
  userInput: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 900,
        system: input.systemPrompt,
        messages: [
          {
            role: "user",
            content: input.userInput,
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || `Remote provider failed with status ${response.status}`);
    }

    return payload.content?.find((item) => item.type === "text")?.text?.trim() || "";
  } finally {
    clearTimeout(timeout);
  }
}

async function callRemoteProvider(input: {
  systemPrompt: string;
  userInput: string;
}) {
  const config = getHttpConfig();

  if (!config.endpoint || !config.apiKey || !config.model) {
    throw new Error("AI_HTTP_ENDPOINT, AI_HTTP_API_KEY and AI_HTTP_MODEL must be configured for remote mode.");
  }

  if (config.provider === "anthropic") {
    return {
      text: await callAnthropicCompatible({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.timeoutMs,
        systemPrompt: input.systemPrompt,
        userInput: input.userInput,
      }),
      provider: "anthropic-compatible" as const,
      model: config.model,
    };
  }

  return {
    text: await callOpenAiCompatible({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
      systemPrompt: input.systemPrompt,
      userInput: input.userInput,
    }),
    provider: "openai-compatible" as const,
    model: config.model,
  };
}

export async function validateExecutionRequest(input: {
  agent: Agent;
  payer?: string;
  userInput: string;
}): Promise<ExecutionGuardResult> {
  const maxChars = getMaxInputChars();

  if (input.userInput.trim().length === 0) {
    return { ok: false, status: 400, error: "Execution input is empty" };
  }

  if (input.userInput.length > maxChars) {
    return {
      ok: false,
      status: 413,
      error: `Execution input exceeds ${maxChars} characters`,
    };
  }

  const payer = input.payer?.trim();
  if (!payer) {
    return { ok: true };
  }

  const db = await readDb();
  const windowMs = getRateLimitWindowMs();
  const limit = getRateLimitCount();
  const now = Date.now();
  const recentCount = db.executions.filter(
    (execution) =>
      execution.payer === payer &&
      now - new Date(execution.createdAt).getTime() <= windowMs
  ).length;

  if (recentCount >= limit) {
    return {
      ok: false,
      status: 429,
      error: `Rate limit exceeded: max ${limit} executions per ${Math.round(windowMs / 60000)} minutes`,
    };
  }

  return { ok: true };
}

export async function runAgentExecution(input: {
  agent: Agent;
  userInput: string;
}): Promise<RuntimeExecutionResult> {
  const startedAt = Date.now();
  const systemPrompt = decryptPrompt(input.agent) || "Prompt unavailable";
  const promptDigest = `0x${createHash("sha256").update(systemPrompt).digest("hex")}`;
  const mode = getRuntimeMode();

  if (mode !== "local") {
    try {
      const remote = await callRemoteProvider({
        systemPrompt,
        userInput: input.userInput,
      });

      return {
        result: remote.text || "Remote provider returned an empty response.",
        backendMode: "remote-http",
        provider: remote.provider,
        model: remote.model,
        latencyMs: Date.now() - startedAt,
        promptDigest,
      };
    } catch (error) {
      return {
        result: error instanceof Error ? error.message : "Remote provider execution failed.",
        backendMode: "strict-unavailable",
        provider: getHttpProvider() === "anthropic" ? "anthropic-compatible" : "openai-compatible",
        model: process.env.AI_HTTP_MODEL?.trim() || "unconfigured",
        latencyMs: Date.now() - startedAt,
        promptDigest,
      };
    }
  }

  return {
    result: buildLocalSimulatedResult(input.agent, input.userInput, systemPrompt),
    backendMode: "local-simulated",
    provider: "local",
    model: "simulated-v1",
    latencyMs: Date.now() - startedAt,
    promptDigest,
  };
}
