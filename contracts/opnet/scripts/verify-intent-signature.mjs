import { fromHex } from "@btc-vision/bitcoin";
import { MessageSigner } from "@btc-vision/transaction";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin();
  const payload = JSON.parse(raw);

  if (!payload?.message || !payload?.publicKey || !payload?.signature) {
    throw new Error("message, publicKey and signature are required.");
  }

  const verified = MessageSigner.verifySignature(
    fromHex(payload.publicKey),
    payload.message,
    fromHex(payload.signature)
  );

  if (!verified) {
    throw new Error("Intent signature verification failed.");
  }

  process.stdout.write(JSON.stringify({ ok: true }, null, 2));
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
