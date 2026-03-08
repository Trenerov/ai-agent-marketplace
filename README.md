# AI Agent Marketplace

AI Agent Marketplace is a Bitcoin-native product for minting, using, and trading AI agents on OP_NET.

Creators turn prompts into on-chain agent assets, earn from every paid execution, and can sell successful agents on a secondary market. Buyers get specialized AI tools with clear per-use pricing instead of subscriptions or closed platforms.

## What The Project Is

This project is an AI marketplace where:

- creators launch AI agents as on-chain assets
- users pay in sats to run an agent for a specific task
- successful agents can be listed and sold
- creator royalties stay attached to the asset

In product terms, it sits between:

- an AI app store
- a creator monetization platform
- a Bitcoin-native asset marketplace

## Why It Matters

Most AI products today have two problems:

- creators do not really own or monetize their agents as assets
- buyers pay for subscriptions instead of paying only when value is delivered

This project changes that by combining:

- pay-per-use AI
- on-chain ownership
- secondary market trading
- creator royalties

## Core Value

- `Pay-per-use`: users pay only when they actually run an agent
- `Creator revenue`: every execution generates income for the agent owner
- `Tradable agents`: agents can be bought and sold like productive digital assets
- `Protected prompts`: prompt data is designed around encrypted storage and on-chain hashes
- `Bitcoin-native`: built around OP_NET instead of a generic SaaS stack

## Who It Is For

- `Creators`: prompt engineers, indie builders, AI tinkerers
- `Users`: people who want specialized agents without subscriptions
- `Traders`: people who want to buy and resell valuable agents
- `Protocols`: teams that may later plug agents into their own products

## Main Product Flows

### 1. Create

The creator opens `/create`, defines:

- name
- description
- category
- prompt
- price per use
- royalty

Then the creator mints the agent and gets an agent detail page.

### 2. Use

The buyer opens an agent page or playground, sees the price in sats, and pays to run the agent.

### 3. Earn

The creator dashboard tracks:

- active agents
- usage
- revenue
- recent activity

### 4. Trade

If an agent performs well, the owner can list it for sale and another user can buy it.

## Product Pages

- `/` landing and marketplace overview
- `/marketplace` listings and agent discovery
- `/create` mint wizard
- `/agent/[id]` agent detail page
- `/agent/[id]/play` paid execution playground
- `/dashboard` creator dashboard

## Current MVP Status

The repository is already a strong contest MVP.

What works now:

- polished frontend for the main marketplace flows
- local persistent app state
- create, use, list, and buy flows in MVP mode
- OP_NET contract workspace with deploy/build tooling
- wallet-aware UI
- contract intent, broadcast, and read/index layers
- live-ready environment wiring for Vercel

What is still not fully production-complete:

- full write-enabled OP_NET testnet flow is still limited by runtime behavior on freshly deployed contracts
- some chain interactions still rely on staged intent/broadcast flows rather than a fully mature production wallet UX

So the right framing is:

- `contest-ready MVP`: yes
- `full production protocol`: not yet

## Demo Story

Recommended product demo:

1. Open `/marketplace`
2. Open an agent detail page
3. Show the paid usage flow in `/agent/[id]/play`
4. Open `/create` and walk through agent creation
5. Open `/dashboard` and show creator-side earnings and activity

## Tech Stack

- `Frontend`: Next.js, React, Tailwind CSS
- `Contracts`: OP_NET, AssemblyScript
- `Backend`: Next.js API routes, AI runtime adapter
- `Data`: local store plus contract journal/index/query layers
- `Deployment`: Vercel

## Runtime Modes

The app can read data in three modes:

- `local`: local persistent store only
- `overlay`: local data merged with contract activity
- `index`: contract-oriented read model

This is useful for demos because the product can still run cleanly even when live chain behavior is partially limited.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful validation:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Environment

Copy `.env.example` into your local env file and fill the values you need.

Minimum useful env:

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

Optional remote AI env:

```bash
AI_HTTP_PROVIDER=openai
AI_HTTP_ENDPOINT=
AI_HTTP_API_KEY=
AI_HTTP_MODEL=
AI_HTTP_TIMEOUT_MS=30000
```

Do not commit:

- `.env.local`
- `.env.contracts.local`
- secrets or mnemonic phrases

## OP_NET Contracts

The contract workspace lives in `contracts/opnet`.

Useful commands:

```bash
cd contracts/opnet
npm install
npm run build
npm test
npm run deploy:plan
npm run deploy:dry-run
```

The app can read deployment info from:

- `.env.local`
- `contracts/opnet/deployment/state.json`

If you already have deployment data, you can sync contract addresses back into the app env from the contracts workspace.

## Deploy To Vercel

Use the Next.js app folder as the Vercel root.

- `Root Directory`: `ai-agent-marketplace`
- `Install Command`: `npm install`
- `Build Command`: `npm run build`
- `Output Directory`: leave empty

Recommended Vercel env:

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

Do not set `OPNET_MNEMONIC` in Vercel unless you explicitly want server-side broadcasting.

After deploy, check:

- `/marketplace?source=index`
- `/create?source=index`
- `/dashboard?source=index`

## Repo Notes

- local persistent state lives in `data/marketplace-db.json`
- contract journal/index snapshots live in `data/contract-journal.json` and `data/contract-index.json`
- current testnet deployment state is tracked in `contracts/opnet/deployment/state.json`

## Current Submission Framing

If you are using this for a contest or demo day, the most accurate one-line description is:

> A Bitcoin-native marketplace where AI agents become monetizable, tradeable assets.
