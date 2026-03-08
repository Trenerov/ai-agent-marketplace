export type CategoryId = 0 | 1 | 2 | 3 | 4 | 5;

export type AgentCategory = {
  id: CategoryId;
  name: string;
  short: string;
  description: string;
};

export type AgentReview = {
  user: string;
  rating: number;
  comment: string;
};

export type AgentSample = {
  input: string;
  output: string;
};

export type UsageRecord = {
  payer: string;
  amount: number;
  txHash: string;
  createdAt: string;
};

export type Agent = {
  id: number;
  name: string;
  category: CategoryId;
  description: string;
  icon: string;
  owner: string;
  creator: string;
  promptHash: string;
  metadataUri: string;
  pricePerUse: number;
  totalUses: number;
  totalRevenue: number;
  avgRating: number;
  responseTime: string;
  isActive: boolean;
  royaltyBps: number;
  createdAt: string;
  promptCiphertext?: string;
  promptIv?: string;
  promptTag?: string;
  sampleOutputs: AgentSample[];
  reviews: AgentReview[];
  usageHistory: UsageRecord[];
};

export type Listing = {
  id: number;
  agentId: number;
  seller: string;
  price: number;
  isActive: boolean;
  createdAt: string;
};

export type RevenuePoint = {
  name: string;
  revenue: number;
  uses: number;
};

export type ActivityItem = {
  title: string;
  detail: string;
  timestamp: string;
  type: "sale" | "payment" | "mint";
};

export type PlanTask = {
  name: string;
  detail: string;
  vibe: string;
  time: string;
};

export type PlanPhase = {
  id: number;
  title: string;
  duration: string;
  priority: "critical" | "high" | "medium";
  emoji: string;
  tasks: PlanTask[];
};

export const categories: AgentCategory[] = [
  { id: 0, name: "Trading", short: "TRD", description: "Market analysis, signals, strategies." },
  { id: 1, name: "Content", short: "CNT", description: "Writing, social, marketing and thread generation." },
  { id: 2, name: "Code", short: "DEV", description: "Code review, debugging and contract auditing." },
  { id: 3, name: "Data", short: "DAT", description: "On-chain analytics, parsing and visualization." },
  { id: 4, name: "Support", short: "SUP", description: "FAQ, onboarding and protocol support." },
  { id: 5, name: "Creative", short: "ART", description: "Storytelling, NFT copy and ideation." },
];

export const valueProps = [
  {
    title: "Revenue Sharing",
    description: "85% to creator, 10% protocol, 5% referral. Passive income from every paid run.",
  },
  {
    title: "IP Protection",
    description: "Prompts stay encrypted, only the execution layer handles decryption.",
  },
  {
    title: "Pay-per-Use",
    description: "Users pay in sats only when they actually run an agent.",
  },
  {
    title: "NFT Ownership",
    description: "Agents are tradable OP_20 assets with royalties on resale.",
  },
];

export const techStack = [
  { label: "Contracts", items: ["OP_NET Runtime", "OP_20", "AssemblyScript"] },
  { label: "Frontend", items: ["Next.js", "Tailwind CSS", "Recharts"] },
  { label: "AI Layer", items: ["Claude API", "AES-256", "IPFS / Pinata"] },
  { label: "Infra", items: ["Vercel", "Supabase", "OP_NET Testnet"] },
];

export const agentTemplates = [
  {
    category: "Trading",
    name: "BTC Analyst",
    prompt:
      "You are a Bitcoin market analyst. Analyze {input} and provide trend, support/resistance and risk assessment.",
  },
  {
    category: "Content",
    name: "Thread Writer",
    prompt:
      "You are a Twitter thread expert. Given topic {input}, write a viral 5-7 tweet thread with a strong hook.",
  },
  {
    category: "Code",
    name: "Contract Auditor",
    prompt:
      "You are a smart contract security auditor. Review {input} for reentrancy, overflow, access control and gas issues.",
  },
  {
    category: "Data",
    name: "Chain Analyzer",
    prompt:
      "You are an on-chain analyst. Given {input}, analyze flow of funds, risk score and entity hints.",
  },
  {
    category: "Support",
    name: "Protocol Helper",
    prompt:
      "You are a protocol support assistant. Answer {input} clearly and only using trusted docs and product facts.",
  },
  {
    category: "Creative",
    name: "NFT Describer",
    prompt:
      "You are a creative writer for NFT collections. Given {input}, write name, description, lore and standout traits.",
  },
];

export const phases: PlanPhase[] = [
  {
    id: 1,
    title: "Architecture and Setup",
    duration: "Day 1",
    priority: "critical",
    emoji: "01",
    tasks: [
      {
        name: "Initialize OP_NET workspace",
        detail: "Set up the starter, wire wallet support and verify testnet deployment early.",
        vibe: "Starter first, contracts compiling before UI polish.",
        time: "2h",
      },
      {
        name: "Design contract interfaces",
        detail: "Define Agent, Registry, Marketplace and payment interactions before implementation.",
        vibe: "Diagram the flow before writing runtime logic.",
        time: "2h",
      },
      {
        name: "Lock tokenomics",
        detail: "Use the 85/10/5 split with sats-based pricing and fixed-price sales for MVP.",
        vibe: "Simple economics win hackathons.",
        time: "1h",
      },
    ],
  },
  {
    id: 2,
    title: "Core Contracts",
    duration: "Day 1-2",
    priority: "critical",
    emoji: "02",
    tasks: [
      {
        name: "AgentNFT",
        detail: "Mint agent ownership with metadata, prompt hash and pricing fields.",
        vibe: "Agent equals asset.",
        time: "3h",
      },
      {
        name: "Registry",
        detail: "Discovery and indexing layer for categories, listings and ranking.",
        vibe: "Keep the query path simple.",
        time: "2h",
      },
      {
        name: "UsagePayment",
        detail: "Validate amount, split revenue and emit execution events.",
        vibe: "This is the money path. Treat it accordingly.",
        time: "3h",
      },
      {
        name: "Marketplace",
        detail: "Fixed-price listings with creator royalty enforcement.",
        vibe: "Skip auctions in MVP.",
        time: "2h",
      },
    ],
  },
  {
    id: 3,
    title: "AI Backend",
    duration: "Day 2-3",
    priority: "high",
    emoji: "03",
    tasks: [
      {
        name: "Execution engine",
        detail: "Verify payment, fetch prompt, decrypt and call LLM provider.",
        vibe: "Payment proof first, model call second.",
        time: "4h",
      },
      {
        name: "Encrypted prompt storage",
        detail: "Store ciphertext off-chain and keep only hash on-chain.",
        vibe: "Protect creator IP.",
        time: "2h",
      },
      {
        name: "Templates",
        detail: "Offer six category-driven prompt starters to speed onboarding.",
        vibe: "Reduce blank-page friction.",
        time: "1.5h",
      },
    ],
  },
  {
    id: 4,
    title: "Frontend Marketplace UI",
    duration: "Day 3-4",
    priority: "high",
    emoji: "04",
    tasks: [
      {
        name: "Explore page",
        detail: "Hero, search, trending, categories and monetization hooks.",
        vibe: "Crypto premium, not generic SaaS.",
        time: "3h",
      },
      {
        name: "Agent detail",
        detail: "Samples, stats, reviews, buy and use flows in one place.",
        vibe: "Treat it like a product page.",
        time: "3h",
      },
      {
        name: "Create wizard",
        detail: "Four-step flow for info, prompt, pricing and mint preview.",
        vibe: "Guided flow beats long forms.",
        time: "3h",
      },
      {
        name: "Dashboard",
        detail: "Revenue, usage, ownership and settings for creators.",
        vibe: "Metrics over clutter.",
        time: "3h",
      },
      {
        name: "Playground",
        detail: "Embedded chat-like execution surface with price awareness.",
        vibe: "Mini-ChatGPT inside the marketplace.",
        time: "2h",
      },
    ],
  },
];

export const seededAgents: Agent[] = [
  {
    id: 1,
    name: "BTC Oracle",
    category: 0,
    description: "Analyzes BTC price action with technical indicators, market structure and liquidity context.",
    icon: "BO",
    owner: "bc1q8f...0net",
    creator: "bc1q8f...0net",
    promptHash: "0xbtc0racle001",
    metadataUri: "ipfs://btc-oracle",
    pricePerUse: 500,
    totalUses: 1248,
    totalRevenue: 624000,
    avgRating: 4.9,
    responseTime: "5.4s",
    isActive: true,
    royaltyBps: 500,
    createdAt: "2026-03-05",
    sampleOutputs: [
      {
        input: "BTC at 92k with strong spot inflows.",
        output: "Bias remains bullish while 90.8k holds. Primary resistance is 94.2k, invalidation below 89.6k.",
      },
      {
        input: "What does a sweep of Asia lows imply?",
        output: "It usually signals liquidity collection. Wait for reclaim and displacement before chasing direction.",
      },
    ],
    reviews: [
      { user: "0xAlex", rating: 5, comment: "Best agent for quick pre-market BTC framing." },
      { user: "0xMara", rating: 5, comment: "Signals are concise and explain risk, not just direction." },
    ],
    usageHistory: [
      { payer: "bc1qa1...8x2", amount: 500, txHash: "0xpay001", createdAt: "2026-03-07 14:04" },
      { payer: "bc1qg9...3pa", amount: 500, txHash: "0xpay002", createdAt: "2026-03-07 13:31" },
      { payer: "bc1qz2...7lk", amount: 500, txHash: "0xpay003", createdAt: "2026-03-07 12:48" },
    ],
  },
  {
    id: 2,
    name: "Thread Machine",
    category: 1,
    description: "Generates sharp crypto Twitter threads with hooks, structure and CTA-ready endings.",
    icon: "TM",
    owner: "bc1qtw...88a",
    creator: "bc1qtw...88a",
    promptHash: "0xthread002",
    metadataUri: "ipfs://thread-machine",
    pricePerUse: 300,
    totalUses: 2107,
    totalRevenue: 632100,
    avgRating: 4.8,
    responseTime: "3.1s",
    isActive: true,
    royaltyBps: 500,
    createdAt: "2026-03-04",
    sampleOutputs: [
      {
        input: "Why Bitcoin AI rails matter.",
        output: "1/ AI without payments is a demo. Bitcoin gives agents money rails. Here is why OP_NET changes the game...",
      },
      {
        input: "Turn product launch notes into a thread.",
        output: "Hook: Most launches fail because nobody understands the value in 10 seconds. This launch fixes that...",
      },
    ],
    reviews: [
      { user: "0xSofi", rating: 5, comment: "Delivers posting-ready threads without cleanup." },
      { user: "0xRune", rating: 4, comment: "Could use more edgy hooks, but output is consistent." },
    ],
    usageHistory: [
      { payer: "bc1qqx...1ma", amount: 300, txHash: "0xpay101", createdAt: "2026-03-07 13:52" },
      { payer: "bc1qpk...2dd", amount: 300, txHash: "0xpay102", createdAt: "2026-03-07 13:17" },
      { payer: "bc1qel...9co", amount: 300, txHash: "0xpay103", createdAt: "2026-03-07 11:06" },
    ],
  },
  {
    id: 3,
    name: "Solidity Guard",
    category: 2,
    description: "Audits smart contracts for critical flaws, edge cases and gas issues with clear severity labels.",
    icon: "SG",
    owner: "bc1qse...102",
    creator: "bc1qse...102",
    promptHash: "0xguard003",
    metadataUri: "ipfs://solidity-guard",
    pricePerUse: 1000,
    totalUses: 734,
    totalRevenue: 734000,
    avgRating: 4.95,
    responseTime: "6.2s",
    isActive: true,
    royaltyBps: 700,
    createdAt: "2026-03-05",
    sampleOutputs: [
      {
        input: "Review this upgradeable treasury contract.",
        output: "Critical: initializer can be front-run if proxy deployment and setup are separated. Medium: unchecked low-level call result.",
      },
      {
        input: "Any gas issues in the withdraw loop?",
        output: "Yes. Iterating over dynamic user arrays risks griefing. Replace full scans with pull-based accounting.",
      },
    ],
    reviews: [
      { user: "0xBuildr", rating: 5, comment: "Saved us from shipping an unsafe initializer." },
      { user: "0xKira", rating: 5, comment: "Best mix of severity and concrete fixes." },
    ],
    usageHistory: [
      { payer: "bc1qum...3ef", amount: 1000, txHash: "0xpay201", createdAt: "2026-03-07 12:43" },
      { payer: "bc1qka...1uo", amount: 1000, txHash: "0xpay202", createdAt: "2026-03-07 10:11" },
    ],
  },
  {
    id: 4,
    name: "Whale Tracker",
    category: 3,
    description: "Identifies whale wallet movements, exchange flow and suspicious clusters in near real time.",
    icon: "WT",
    owner: "bc1qdt...209",
    creator: "bc1qdt...209",
    promptHash: "0xwhale004",
    metadataUri: "ipfs://whale-tracker",
    pricePerUse: 800,
    totalUses: 918,
    totalRevenue: 734400,
    avgRating: 4.7,
    responseTime: "4.4s",
    isActive: true,
    royaltyBps: 500,
    createdAt: "2026-03-03",
    sampleOutputs: [
      {
        input: "Address bc1qxyz...",
        output: "Cluster suggests market-making activity. Last 24h shows 3 exchange interactions and one cold-storage refill.",
      },
      {
        input: "What happened around the 1,500 BTC transfer?",
        output: "Funds moved from a long-dormant wallet into a fresh cluster, then split across two exchange deposit paths.",
      },
    ],
    reviews: [
      { user: "0xNori", rating: 4, comment: "Useful context before large moves hit the timeline." },
      { user: "0xDax", rating: 5, comment: "The cluster heuristics are strong for a cheap per-use tool." },
    ],
    usageHistory: [
      { payer: "bc1qva...8ui", amount: 800, txHash: "0xpay301", createdAt: "2026-03-07 13:04" },
      { payer: "bc1qio...6no", amount: 800, txHash: "0xpay302", createdAt: "2026-03-07 09:37" },
    ],
  },
  {
    id: 5,
    name: "Rune Helper",
    category: 4,
    description: "Answers questions about Bitcoin Runes, onboarding flows and ecosystem terminology.",
    icon: "RH",
    owner: "bc1qhl...557",
    creator: "bc1qhl...557",
    promptHash: "0xrune005",
    metadataUri: "ipfs://rune-helper",
    pricePerUse: 200,
    totalUses: 2844,
    totalRevenue: 568800,
    avgRating: 4.6,
    responseTime: "2.8s",
    isActive: true,
    royaltyBps: 500,
    createdAt: "2026-03-02",
    sampleOutputs: [
      {
        input: "How do I mint a Rune?",
        output: "You need a compatible wallet, enough BTC for fees and the etching parameters. The key distinction is etching versus minting supply.",
      },
      {
        input: "Explain cap and premine simply.",
        output: "Cap is the total possible mintable supply. Premine is the portion assigned at creation before public minting.",
      },
    ],
    reviews: [
      { user: "0xMilo", rating: 4, comment: "Great first-stop explainer for newcomers." },
      { user: "0xPia", rating: 5, comment: "Cheap, fast and accurate enough for support flows." },
    ],
    usageHistory: [
      { payer: "bc1qrs...4er", amount: 200, txHash: "0xpay401", createdAt: "2026-03-07 14:15" },
      { payer: "bc1qyu...7ii", amount: 200, txHash: "0xpay402", createdAt: "2026-03-07 14:01" },
      { payer: "bc1qke...9lp", amount: 200, txHash: "0xpay403", createdAt: "2026-03-07 13:44" },
    ],
  },
  {
    id: 6,
    name: "PFP Writer",
    category: 5,
    description: "Creates lore, trait callouts and collection copy for NFT drops and profile-picture projects.",
    icon: "PW",
    owner: "bc1qfa...610",
    creator: "bc1qfa...610",
    promptHash: "0xpfp006",
    metadataUri: "ipfs://pfp-writer",
    pricePerUse: 400,
    totalUses: 1160,
    totalRevenue: 464000,
    avgRating: 4.85,
    responseTime: "3.7s",
    isActive: true,
    royaltyBps: 500,
    createdAt: "2026-03-01",
    sampleOutputs: [
      {
        input: "Cyber samurai collection with 8,888 supply.",
        output: "Forged in signal storms, each samurai carries a shard of a failed future market and a vow to rewrite it.",
      },
      {
        input: "Need trait copy for neon visor rarity.",
        output: "Neon Visor marks scouts who crossed the mempool dusk and returned with unfiltered alpha.",
      },
    ],
    reviews: [
      { user: "0xLena", rating: 5, comment: "Way more character than generic AI lore tools." },
      { user: "0xRex", rating: 5, comment: "Perfect for fast collection drafts." },
    ],
    usageHistory: [
      { payer: "bc1quw...3tr", amount: 400, txHash: "0xpay501", createdAt: "2026-03-07 11:22" },
      { payer: "bc1qdi...8vb", amount: 400, txHash: "0xpay502", createdAt: "2026-03-07 10:03" },
    ],
  },
];

export const activeListings: Listing[] = [
  { id: 101, agentId: 1, seller: "bc1q8f...0net", price: 280000, isActive: true, createdAt: "2026-03-07" },
  { id: 102, agentId: 3, seller: "bc1qse...102", price: 490000, isActive: true, createdAt: "2026-03-06" },
  { id: 103, agentId: 4, seller: "bc1qdt...209", price: 360000, isActive: true, createdAt: "2026-03-06" },
];

export const revenueSeries: RevenuePoint[] = [
  { name: "Mon", revenue: 68000, uses: 82 },
  { name: "Tue", revenue: 72000, uses: 91 },
  { name: "Wed", revenue: 81400, uses: 103 },
  { name: "Thu", revenue: 93400, uses: 118 },
  { name: "Fri", revenue: 108200, uses: 131 },
  { name: "Sat", revenue: 119600, uses: 146 },
];

export const activityFeed: ActivityItem[] = [
  {
    title: "Secondary sale closed",
    detail: "BTC Oracle moved into active listing with creator royalty locked at 5%.",
    timestamp: "8m ago",
    type: "sale",
  },
  {
    title: "Usage spike",
    detail: "Rune Helper crossed 2,800 paid executions on testnet.",
    timestamp: "26m ago",
    type: "payment",
  },
  {
    title: "New mint queued",
    detail: "A new data-analysis agent completed prompt encryption and is ready to mint.",
    timestamp: "1h ago",
    type: "mint",
  },
];

export const walletSummary = {
  address: "bc1q8f...0net",
  network: "OP_NET testnet",
  balanceBtc: "0.1842 BTC",
  activeAgents: 3,
  totalEarned: 1421800,
};

export function getAgent(id: number) {
  return seededAgents.find((agent) => agent.id === id);
}

export function getTrendingAgents(limit = 6) {
  return [...seededAgents].sort((a, b) => b.totalUses - a.totalUses).slice(0, limit);
}

export function getActiveListings() {
  return activeListings.map((listing) => ({
    ...listing,
    agent: getAgent(listing.agentId),
  }));
}

export function getCategoryById(id: CategoryId) {
  return categories.find((item) => item.id === id);
}

export function getStats() {
  const totalUses = seededAgents.reduce((sum, agent) => sum + agent.totalUses, 0);
  const totalRevenue = seededAgents.reduce((sum, agent) => sum + agent.totalRevenue, 0);

  return {
    totalAgents: seededAgents.length,
    totalUses,
    totalRevenue,
    activeUsers: 1842,
  };
}
