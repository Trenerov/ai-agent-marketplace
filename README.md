AI Agent Marketplace is a contest-ready Next.js MVP for minting, using and trading AI agents on OP_NET.

## GitHub Push Checklist

Before pushing this repository:

1. Keep local secrets out of git.
2. Do not commit `.env.local` or `.env.contracts.local`.
3. Only commit `.env.example`.
4. If you do not want to publish current testnet deployment state, skip `contracts/opnet/deployment/state.json`.
5. Run:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Current production smoke-tested routes:

- `/dashboard?source=index`
- `/marketplace?source=index`
- `/create?source=index`

## Quick Demo

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Recommended judge flow:

1. Open `/dashboard` and show contract readiness plus indexer activity.
2. Switch the navbar `source` between `local`, `overlay`, and `index`.
3. Open `/create` and mint an agent.
4. Open `/agent/[id]` and show list or buy flow.
5. Open `/agent/[id]/play` and run the paid execution flow.

Local state is persisted in `data/marketplace-db.json`.

## Testnet Before Vercel

To run the product against OP_NET testnet instead of the local store:

1. Deploy contracts from `contracts/opnet` or fill real deployed addresses.
2. Set:
   - `OPNET_RPC_URL`
   - `OPNET_AGENT_NFT_ADDRESS`
   - `OPNET_AGENT_REGISTRY_ADDRESS`
   - `OPNET_USAGE_PAYMENT_ADDRESS`
   - `OPNET_MARKETPLACE_ADDRESS`
   - `OPNET_LIVE_READS=1`
3. Keep `source=index` or leave `DATA_SOURCE_MODE` empty. With `OPNET_LIVE_READS=1`, the app now defaults to `index`.
4. For server-side broadcasting, also set `OPNET_MNEMONIC`.
5. For browser signing only, skip `OPNET_MNEMONIC` and use `prepare -> sign -> broadcast-signed`.

For Vercel specifically, root install now runs `npm --prefix contracts/opnet install`, so the nested OP_NET scripts used by API routes are available during deployment.

## Deploy To Vercel

Use the Next.js app root as the Vercel project root:

- Root Directory: `ai-agent-marketplace`
- Install Command: leave default (`npm install`)
- Build Command: leave default (`npm run build`)
- Output Directory: leave empty

Recommended Vercel env for the current contest MVP:

```bash
NEXT_PUBLIC_OPNET_NETWORK=opnet-testnet
OPNET_NETWORK=opnetTestnet
OPNET_RPC_URL=https://testnet.opnet.org
OPNET_LIVE_READS=1
OPNET_AGENT_NFT_ADDRESS=
OPNET_AGENT_REGISTRY_ADDRESS=
OPNET_USAGE_PAYMENT_ADDRESS=
OPNET_MARKETPLACE_ADDRESS=
AGENT_ENCRYPTION_SECRET=change-me
AI_BACKEND_MODE=local
```

Optional env:

```bash
AI_HTTP_PROVIDER=openai
AI_HTTP_ENDPOINT=
AI_HTTP_API_KEY=
AI_HTTP_MODEL=
AI_HTTP_TIMEOUT_MS=30000
```

Do not set `OPNET_MNEMONIC` in Vercel unless you explicitly want server-side broadcasting.

After deploy, verify:

1. `/dashboard?source=index`
2. `/marketplace?source=index`
3. `/create?source=index`

Current OP_NET status:

- read/index mode is ready for demo deployment
- deployed testnet addresses are available
- contract configure and full write-enabled on-chain flow are still blocked by OP_NET runtime behavior on freshly deployed contracts

## Runtime Modes

The app exposes its runtime mode directly in the UI and API.

- `source=local`: reads from the local persistent store
- `source=overlay`: reads from local store merged with contract journal and indexed receipts
- `source=index`: reads from the materialized contract query layer

Write behavior is explicit:

- if the matching contract is frontend-ready, writes return an OP_NET intent and execute on-chain
- if contracts are not ready and source is `local` or `overlay`, writes fall back to the local store
- if contracts are not ready and source is `index`, writes are blocked as read-only

This prevents silent fallback from chain-backed reads into local writes during demos.

## Main Routes

- `/` landing and roadmap
- `/marketplace` listings view
- `/create` mint wizard
- `/agent/[id]` agent detail
- `/agent/[id]/play` paid execution playground
- `/dashboard` creator dashboard, contract readiness, journal and indexer status

## Contracts

Build OP_NET contracts:

```bash
cd contracts/opnet
npm run build
npm test
npm run deploy:plan
npm run deploy:dry-run
```

The app reads deployment readiness from:

- `.env.local`
- `contracts/opnet/deployment/state.json`

To wire addresses manually, copy `.env.example` to `.env.local` and fill:

```bash
NEXT_PUBLIC_OPNET_NETWORK=opnet-testnet
OPNET_AGENT_NFT_ADDRESS=
OPNET_AGENT_REGISTRY_ADDRESS=
OPNET_USAGE_PAYMENT_ADDRESS=
OPNET_MARKETPLACE_ADDRESS=
```

Or sync env values from the contracts workspace:

```bash
cd contracts/opnet
npm run deploy:sync-env
```

If `OPNET_MNEMONIC` and RPC config are present, on-chain intents can be broadcast through `/api/contracts/broadcast`.
Offline signing bundles can be created through `/api/contracts/prepare`.
Already signed raw transactions can be sent through `/api/contracts/broadcast-signed`.

## AI Backend

The execution backend runs through a provider adapter.

- `AI_BACKEND_MODE=local` uses the simulated local provider
- any non-`local` mode uses the HTTP adapter and calls a remote LLM endpoint

Useful env knobs:

```bash
AGENT_ENCRYPTION_SECRET=change-me
AI_BACKEND_MODE=local
AI_HTTP_PROVIDER=openai
AI_HTTP_ENDPOINT=
AI_HTTP_API_KEY=
AI_HTTP_MODEL=
AI_HTTP_TIMEOUT_MS=30000
AI_MAX_INPUT_CHARS=2000
AI_RATE_LIMIT_COUNT=5
AI_RATE_LIMIT_WINDOW_MS=300000
```

Supported HTTP dialects:

- `AI_HTTP_PROVIDER=openai` for OpenAI-compatible `chat/completions`
- `AI_HTTP_PROVIDER=anthropic` for Anthropic-compatible `messages`

If remote mode is enabled but misconfigured, `/api/execute` returns `503` instead of silently falling back.
