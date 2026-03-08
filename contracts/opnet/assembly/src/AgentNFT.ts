import { u256 } from "@btc-vision/as-bignum/assembly";
import {
  Blockchain,
  BytesWriter,
  Calldata,
  OP721,
  OP721InitParameters,
  Revert,
  SafeMath,
  StoredAddressArray,
  StoredBooleanArray,
  StoredString,
  StoredU16Array,
  StoredU256Array,
  StoredU8Array,
} from "@btc-vision/btc-runtime/runtime";
import { EMPTY_POINTER } from "@btc-vision/btc-runtime/runtime/math/bytes";
import {
  AgentMetadataUpdatedEvent,
  AgentMintedEvent,
  AgentPriceUpdatedEvent,
  AgentToggledEvent,
} from "./events";
import { AgentCategory, DEFAULT_ROYALTY_BPS } from "./shared";

@final
export class AgentNFT extends OP721 {
  private readonly pricePointer: u16 = Blockchain.nextPointer;
  private readonly creatorPointer: u16 = Blockchain.nextPointer;
  private readonly activePointer: u16 = Blockchain.nextPointer;
  private readonly categoryPointer: u16 = Blockchain.nextPointer;
  private readonly royaltyPointer: u16 = Blockchain.nextPointer;
  private readonly totalUsesPointer: u16 = Blockchain.nextPointer;
  private readonly totalRevenuePointer: u16 = Blockchain.nextPointer;
  private readonly promptHashPointer: u16 = Blockchain.nextPointer;
  private readonly metadataPointer: u16 = Blockchain.nextPointer;

  private readonly priceByAgent!: StoredU256Array;
  private readonly creatorByAgent!: StoredAddressArray;
  private readonly activeByAgent!: StoredBooleanArray;
  private readonly categoryByAgent!: StoredU8Array;
  private readonly royaltyByAgent!: StoredU16Array;
  private readonly totalUsesByAgent!: StoredU256Array;
  private readonly totalRevenueByAgent!: StoredU256Array;
  private readonly promptHashStorage: Map<u64, StoredString> = new Map();
  private readonly metadataStorage: Map<u64, StoredString> = new Map();

  public constructor() {
    super();
    this.priceByAgent = new StoredU256Array(this.pricePointer, EMPTY_POINTER);
    this.creatorByAgent = new StoredAddressArray(this.creatorPointer, EMPTY_POINTER);
    this.activeByAgent = new StoredBooleanArray(this.activePointer, EMPTY_POINTER);
    this.categoryByAgent = new StoredU8Array(this.categoryPointer, EMPTY_POINTER);
    this.royaltyByAgent = new StoredU16Array(this.royaltyPointer, EMPTY_POINTER);
    this.totalUsesByAgent = new StoredU256Array(this.totalUsesPointer, EMPTY_POINTER);
    this.totalRevenueByAgent = new StoredU256Array(this.totalRevenuePointer, EMPTY_POINTER);
  }

  public override onDeployment(_calldata: Calldata): void {
    this.instantiate(
      new OP721InitParameters(
        "AI Agent Marketplace",
        "AGENT",
        "",
        u256.fromString("1000000"),
        "",
        "",
        "",
        "Composable AI agents as OP_NET NFTs"
      )
    );
  }

  @method(
    { name: "promptHash", type: "string" },
    { name: "metadataURI", type: "string" },
    { name: "pricePerUse", type: "uint256" },
    { name: "category", type: "uint8" },
    { name: "royaltyBps", type: "uint16" }
  )
  @emit("AgentMinted")
  public mint(calldata: Calldata): BytesWriter {
    const promptHash = calldata.readStringWithLength();
    const metadataURI = calldata.readStringWithLength();
    const pricePerUse = calldata.readU256();
    const category = calldata.readU8();
    const royaltyBps = calldata.readU16();
    const sender = Blockchain.tx.sender;
    const tokenId = this._nextTokenId.value;
    const agentIndex = this.toAgentIndexFromNewToken(tokenId);
    const normalizedRoyalty = royaltyBps == 0 ? DEFAULT_ROYALTY_BPS : royaltyBps;

    if (promptHash.length == 0) {
      throw new Revert("Prompt hash cannot be empty");
    }
    if (metadataURI.length == 0) {
      throw new Revert("Metadata URI cannot be empty");
    }
    if (pricePerUse <= u256.Zero) {
      throw new Revert("Price per use must be positive");
    }
    if (category > <u8>AgentCategory.Creative) {
      throw new Revert("Invalid category");
    }

    this._mint(sender, tokenId);
    this._setTokenURI(tokenId, metadataURI);
    this._nextTokenId.value = SafeMath.add(tokenId, u256.One);

    this.priceByAgent.push(pricePerUse);
    this.creatorByAgent.push(sender);
    this.activeByAgent.push(true);
    this.categoryByAgent.push(category);
    this.royaltyByAgent.push(normalizedRoyalty);
    this.totalUsesByAgent.push(u256.Zero);
    this.totalRevenueByAgent.push(u256.Zero);

    this.priceByAgent.save();
    this.creatorByAgent.save();
    this.activeByAgent.save();
    this.categoryByAgent.save();
    this.royaltyByAgent.save();
    this.totalUsesByAgent.save();
    this.totalRevenueByAgent.save();

    this.getPromptHashSlot(agentIndex).value = promptHash;
    this.getMetadataSlot(agentIndex).value = metadataURI;

    this.emitEvent(
      new AgentMintedEvent(tokenId, pricePerUse, category, normalizedRoyalty)
    );

    const writer = new BytesWriter(0);
    writer.writeU256(tokenId);
    writer.writeString(promptHash);
    writer.writeString(metadataURI);
    writer.writeU256(pricePerUse);
    writer.writeU16(normalizedRoyalty);
    return writer;
  }

  @method(
    { name: "agentId", type: "uint256" },
    { name: "newPrice", type: "uint256" }
  )
  @emit("AgentPriceUpdated")
  public updatePrice(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const newPrice = calldata.readU256();
    const index = this.toExistingAgentIndex(agentId);

    this.requireAgentOwner(agentId);
    if (newPrice <= u256.Zero) {
      throw new Revert("Price must be positive");
    }

    this.priceByAgent.set(index, newPrice);
    this.priceByAgent.save();
    this.emitEvent(new AgentPriceUpdatedEvent(agentId, newPrice));

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    writer.writeU256(newPrice);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  @emit("AgentToggled")
  public toggleActive(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const index = this.toExistingAgentIndex(agentId);

    this.requireAgentOwner(agentId);
    this.activeByAgent.set(index, !this.activeByAgent.get(index));
    this.activeByAgent.save();
    this.emitEvent(new AgentToggledEvent(agentId));

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    writer.writeBoolean(this.activeByAgent.get(index));
    return writer;
  }

  @method(
    { name: "agentId", type: "uint256" },
    { name: "metadataURI", type: "string" }
  )
  @emit("AgentMetadataUpdated")
  public updateMetadata(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const metadataURI = calldata.readStringWithLength();
    const index = this.toExistingAgentIndex(agentId);

    this.requireAgentOwner(agentId);
    if (metadataURI.length == 0) {
      throw new Revert("Metadata URI cannot be empty");
    }

    this._setTokenURI(agentId, metadataURI);
    this.getMetadataSlot(<u64>index).value = metadataURI;
    this.emitEvent(new AgentMetadataUpdatedEvent(agentId, metadataURI));

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    writer.writeString(metadataURI);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public getAgent(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const index = this.toExistingAgentIndex(agentId);

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    writer.writeAddress(this._ownerOf(agentId));
    writer.writeAddress(this.creatorByAgent.get(index));
    writer.writeU256(this.priceByAgent.get(index));
    writer.writeBoolean(this.activeByAgent.get(index));
    writer.writeU8(this.categoryByAgent.get(index));
    writer.writeU16(this.royaltyByAgent.get(index));
    writer.writeU256(this.totalUsesByAgent.get(index));
    writer.writeU256(this.totalRevenueByAgent.get(index));
    writer.writeString(this.getPromptHashSlot(index).value);
    writer.writeString(this.getMetadataSlot(<u64>index).value);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public priceOf(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const index = this.toExistingAgentIndex(agentId);

    const writer = new BytesWriter(0);
    writer.writeU256(this.priceByAgent.get(index));
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public promptHashOf(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const index = this.toExistingAgentIndex(agentId);

    const writer = new BytesWriter(0);
    writer.writeString(this.getPromptHashSlot(index).value);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public isActiveAgent(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const index = this.toExistingAgentIndex(agentId);

    const writer = new BytesWriter(0);
    writer.writeBoolean(this.activeByAgent.get(index));
    return writer;
  }

  @method(
    { name: "agentId", type: "uint256" },
    { name: "usageDelta", type: "uint256" },
    { name: "revenueDelta", type: "uint256" }
  )
  public recordUsage(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const usageDelta = calldata.readU256();
    const revenueDelta = calldata.readU256();
    const index = this.toExistingAgentIndex(agentId);

    this.totalUsesByAgent.set(
      index,
      SafeMath.add(this.totalUsesByAgent.get(index), usageDelta)
    );
    this.totalRevenueByAgent.set(
      index,
      SafeMath.add(this.totalRevenueByAgent.get(index), revenueDelta)
    );
    this.totalUsesByAgent.save();
    this.totalRevenueByAgent.save();

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    writer.writeU256(this.totalUsesByAgent.get(index));
    writer.writeU256(this.totalRevenueByAgent.get(index));
    return writer;
  }

  private requireAgentOwner(agentId: u256): void {
    if (this._ownerOf(agentId) !== Blockchain.tx.sender) {
      throw new Revert("Only agent owner can update this agent");
    }
  }

  private toExistingAgentIndex(agentId: u256): u32 {
    if (!this._exists(agentId)) {
      throw new Revert("Agent does not exist");
    }

    return <u32>(agentId.toU64() - 1);
  }

  private toAgentIndexFromNewToken(agentId: u256): u64 {
    return agentId.toU64() - 1;
  }

  private getPromptHashSlot(index: u64): StoredString {
    if (!this.promptHashStorage.has(index)) {
      this.promptHashStorage.set(index, new StoredString(this.promptHashPointer, index));
    }

    return this.promptHashStorage.get(index);
  }

  private getMetadataSlot(index: u64): StoredString {
    if (!this.metadataStorage.has(index)) {
      this.metadataStorage.set(index, new StoredString(this.metadataPointer, index));
    }

    return this.metadataStorage.get(index);
  }
}
