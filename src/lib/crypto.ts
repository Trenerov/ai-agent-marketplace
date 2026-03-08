import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getSecretKey() {
  const secret = process.env.AGENT_ENCRYPTION_SECRET || "local-dev-opnet-agent-marketplace-secret";
  return createHash("sha256").update(secret).digest();
}

export function hashPrompt(prompt: string) {
  return `0x${createHash("sha256").update(prompt).digest("hex")}`;
}

export function encryptPrompt(prompt: string) {
  const iv = randomBytes(12);
  const key = getSecretKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(prompt, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    promptHash: hashPrompt(prompt),
    promptCiphertext: ciphertext.toString("hex"),
    promptIv: iv.toString("hex"),
    promptTag: tag.toString("hex"),
  };
}

export function decryptPrompt(payload: {
  promptCiphertext?: string;
  promptIv?: string;
  promptTag?: string;
}) {
  if (!payload.promptCiphertext || !payload.promptIv || !payload.promptTag) {
    return null;
  }

  const key = getSecretKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.promptIv, "hex"));
  decipher.setAuthTag(Buffer.from(payload.promptTag, "hex"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.promptCiphertext, "hex")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
