import fs from "node:fs/promises";
import path from "node:path";
import { networks } from "@btc-vision/bitcoin";
import { Address } from "@btc-vision/transaction";
import { getContract } from "opnet";
import { getNetworkName, loadDeploymentContext, workspaceRoot } from "./deployment-helpers.mjs";
import { createRpcProvider } from "./provider-helpers.mjs";

function getAbiFile(contractId) {
  switch (contractId) {
    case "agentNft":
      return "AgentNFT.abi.json";
    case "agentRegistry":
      return "AgentRegistry.abi.json";
    case "usagePayment":
      return "UsagePayment.abi.json";
    case "marketplace":
      return "Marketplace.abi.json";
    default:
      throw new Error(`Unknown contract id ${contractId}`);
  }
}

function serializeAddress(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value.p2tr === "string") {
    return value.p2tr;
  }

  if (typeof value.address === "string") {
    return value.address;
  }

  if (typeof value.toString === "function") {
    const next = value.toString();
    if (next && next !== "[object Object]") {
      return next;
    }
  }

  if (typeof value.toHex === "function") {
    return value.toHex();
  }

  return String(value);
}

function numberFromBigInt(value) {
  return Number(value > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : value);
}

async function createContract(provider, network, address, contractId) {
  const abiPath = path.join(workspaceRoot, "abis", getAbiFile(contractId));
  const abi = JSON.parse(await fs.readFile(abiPath, "utf8"));
  return getContract(Address.fromString(address), abi, provider, network);
}

function requireAddress(address, contractId) {
  if (!address || address.trim() === "") {
    throw new Error(`Missing deployed address for ${contractId}.`);
  }

  return address;
}

async function main() {
  const context = await loadDeploymentContext();
  const rpcUrl = context.config?.rpcUrl || process.env.OPNET_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing OPNET_RPC_URL or deployment/config.json rpcUrl.");
  }

  const networkName = getNetworkName(context.config?.network || process.env.OPNET_NETWORK || "opnetTestnet");
  const network = networks[networkName];
  const contracts = {
    agentNft:
      context.state?.contracts?.agentNft?.address?.trim() || process.env.OPNET_AGENT_NFT_ADDRESS || "",
    agentRegistry:
      context.state?.contracts?.agentRegistry?.address?.trim() || process.env.OPNET_AGENT_REGISTRY_ADDRESS || "",
    usagePayment:
      context.state?.contracts?.usagePayment?.address?.trim() || process.env.OPNET_USAGE_PAYMENT_ADDRESS || "",
    marketplace:
      context.state?.contracts?.marketplace?.address?.trim() || process.env.OPNET_MARKETPLACE_ADDRESS || "",
  };

  const provider = createRpcProvider({ url: rpcUrl, network });
  const [agentNft, agentRegistry, usagePayment, marketplace] = await Promise.all([
    createContract(provider, network, requireAddress(contracts.agentNft, "agentNft"), "agentNft"),
    createContract(provider, network, requireAddress(contracts.agentRegistry, "agentRegistry"), "agentRegistry"),
    createContract(provider, network, requireAddress(contracts.usagePayment, "usagePayment"), "usagePayment"),
    createContract(provider, network, requireAddress(contracts.marketplace, "marketplace"), "marketplace"),
  ]);

  const registeredCountCall = await agentRegistry.registeredCount();
  const registeredCount = numberFromBigInt(registeredCountCall.result.readU256());
  const listedCountCall = await marketplace.totalListings();
  const listedCount = numberFromBigInt(listedCountCall.result.readU256());

  const agentIds = [];
  for (let index = 0; index < registeredCount; index += 1) {
    const entry = await agentRegistry.agentIdAt(index);
    agentIds.push(numberFromBigInt(entry.result.readU256()));
  }

  const agents = [];
  for (const agentId of agentIds) {
    const call = await agentNft.getAgent(BigInt(agentId));
    const reader = call.result;
    const id = numberFromBigInt(reader.readU256());
    const owner = serializeAddress(reader.readAddress());
    const creator = serializeAddress(reader.readAddress());
    const pricePerUse = numberFromBigInt(reader.readU256());
    const isActive = reader.readBoolean();
    const category = reader.readU8();
    const royaltyBps = reader.readU16();
    const totalUses = numberFromBigInt(reader.readU256());
    const totalRevenue = numberFromBigInt(reader.readU256());
    const promptHash = reader.readStringWithLength();
    const metadataUri = reader.readStringWithLength();

    agents.push({
      id,
      name: `OP_NET Agent #${id}`,
      category,
      description: `Live state fetched from OP_NET ${networkName}.`,
      icon: "ON",
      owner,
      creator,
      promptHash,
      metadataUri,
      pricePerUse,
      totalUses,
      totalRevenue,
      avgRating: 0,
      responseTime: "chain",
      isActive,
      royaltyBps,
      createdAt: new Date().toISOString().slice(0, 10),
      sampleOutputs: [],
      reviews: [],
      usageHistory: [],
      source: "index",
      mintTxId: context.state?.contracts?.agentNft?.revealTxId || "",
    });
  }

  const listings = [];
  for (let listingId = 1; listingId <= listedCount; listingId += 1) {
    try {
      const call = await marketplace.getListing(BigInt(listingId));
      const reader = call.result;
      const id = numberFromBigInt(reader.readU256());
      const agentId = numberFromBigInt(reader.readU256());
      const seller = serializeAddress(reader.readAddress());
      const price = numberFromBigInt(reader.readU256());
      const isActive = reader.readBoolean();

      listings.push({
        id,
        agentId,
        seller,
        price,
        isActive,
        createdAt: new Date().toISOString().slice(0, 10),
        source: "index",
        listingTxId: context.state?.contracts?.marketplace?.revealTxId || "",
      });
    } catch {
      // Ignore sparse ids or reverted reads.
    }
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        agents: agents.sort((a, b) => b.id - a.id),
        listings: listings.sort((a, b) => b.id - a.id),
        summary: {
          agents: agents.length,
          listings: listings.filter((listing) => listing.isActive).length,
          totalUses: agents.reduce((sum, agent) => sum + agent.totalUses, 0),
          totalRevenue: agents.reduce((sum, agent) => sum + agent.totalRevenue, 0),
          receiptsIndexed: 0,
          network: networkName,
          rpcUrl,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        agents: [],
        listings: [],
        summary: null,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
