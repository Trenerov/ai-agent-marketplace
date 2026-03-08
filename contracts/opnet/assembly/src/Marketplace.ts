import {
  Address,
  Blockchain,
  BytesWriter,
  Calldata,
  OP_NET,
  Revert,
  SafeMath,
  StoredAddress,
  StoredAddressArray,
  StoredBooleanArray,
  StoredMapU256,
  StoredU256,
  StoredU256Array,
  encodeSelector,
} from "@btc-vision/btc-runtime/runtime";
import { u256 } from "@btc-vision/as-bignum/assembly";
import { EMPTY_POINTER } from "@btc-vision/btc-runtime/runtime/math/bytes";
import {
  ListingCancelledEvent,
  ListingCreatedEvent,
  ListingPurchasedEvent,
} from "./events";

@final
export class Marketplace extends OP_NET {
  private readonly agentContractPointer: u16 = Blockchain.nextPointer;
  private readonly nextListingIdPointer: u16 = Blockchain.nextPointer;
  private readonly activeListingCountPointer: u16 = Blockchain.nextPointer;
  private readonly agentByListingPointer: u16 = Blockchain.nextPointer;
  private readonly sellerByListingPointer: u16 = Blockchain.nextPointer;
  private readonly priceByListingPointer: u16 = Blockchain.nextPointer;
  private readonly activeByListingPointer: u16 = Blockchain.nextPointer;
  private readonly listingIdsPointer: u16 = Blockchain.nextPointer;
  private readonly listingByAgentPointer: u16 = Blockchain.nextPointer;

  private readonly agentContract!: StoredAddress;
  private readonly nextListingId!: StoredU256;
  private readonly activeListingCount!: StoredU256;
  private readonly agentByListing!: StoredU256Array;
  private readonly sellerByListing!: StoredAddressArray;
  private readonly priceByListing!: StoredU256Array;
  private readonly activeByListing!: StoredBooleanArray;
  private readonly listingIds!: StoredU256Array;
  private readonly listingByAgent!: StoredMapU256;

  public constructor() {
    super();
    this.agentContract = new StoredAddress(this.agentContractPointer);
    this.nextListingId = new StoredU256(this.nextListingIdPointer, EMPTY_POINTER);
    this.activeListingCount = new StoredU256(this.activeListingCountPointer, EMPTY_POINTER);
    this.agentByListing = new StoredU256Array(this.agentByListingPointer, EMPTY_POINTER);
    this.sellerByListing = new StoredAddressArray(this.sellerByListingPointer, EMPTY_POINTER);
    this.priceByListing = new StoredU256Array(this.priceByListingPointer, EMPTY_POINTER);
    this.activeByListing = new StoredBooleanArray(this.activeByListingPointer, EMPTY_POINTER);
    this.listingIds = new StoredU256Array(this.listingIdsPointer, EMPTY_POINTER);
    this.listingByAgent = new StoredMapU256(this.listingByAgentPointer);
  }

  @method({ name: "agentContract", type: "address" })
  public configureAgentContract(calldata: Calldata): BytesWriter {
    this.onlyDeployer(Blockchain.tx.sender);
    const agentContract = calldata.readAddress();
    if (agentContract === Address.zero()) {
      throw new Revert("Invalid agent contract");
    }

    this.agentContract.value = agentContract;
    return new BytesWriter(0);
  }

  @method(
    { name: "agentId", type: "uint256" },
    { name: "price", type: "uint256" }
  )
  @emit("ListingCreated")
  public list(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const price = calldata.readU256();
    const existingListingId = this.listingByAgent.get(agentId);
    const seller = Blockchain.tx.sender;

    if (price <= u256.Zero) {
      throw new Revert("Listing price must be positive");
    }
    if (!this.isAgentActive(agentId)) {
      throw new Revert("Agent is inactive");
    }
    if (this.getAgentOwner(agentId) !== seller) {
      throw new Revert("Only owner can list agent");
    }

    if (!u256.eq(existingListingId, u256.Zero) && this.isActiveListing(existingListingId)) {
      throw new Revert("Agent already listed");
    }

    this.transferAgentFrom(seller, this.address, agentId);

    const listingId: u256 = SafeMath.add(this.nextListingId.value, u256.One);
    this.nextListingId.set(listingId);

    this.agentByListing.push(agentId);
    this.sellerByListing.push(seller);
    this.priceByListing.push(price);
    this.activeByListing.push(true);
    this.listingIds.push(listingId);

    this.agentByListing.save();
    this.sellerByListing.save();
    this.priceByListing.save();
    this.activeByListing.save();
    this.listingIds.save();

    this.listingByAgent.set(agentId, listingId);
    this.activeListingCount.add(u256.One);

    this.emitEvent(new ListingCreatedEvent(agentId, price));

    const writer = new BytesWriter(0);
    writer.writeU256(listingId);
    writer.writeU256(agentId);
    writer.writeU256(price);
    return writer;
  }

  @method(
    { name: "listingId", type: "uint256" },
    { name: "amount", type: "uint256" }
  )
  @emit("ListingPurchased")
  public buy(calldata: Calldata): BytesWriter {
    const listingId = calldata.readU256();
    const paid = calldata.readU256();
    const listingIndex = this.toListingIndex(listingId);
    const seller = this.sellerByListing.get(listingIndex);
    const price = this.priceByListing.get(listingIndex);
    const agentId = this.agentByListing.get(listingIndex);

    if (!this.activeByListing.get(listingIndex)) {
      throw new Revert("Listing is inactive");
    }

    if (seller === Blockchain.tx.sender) {
      throw new Revert("Seller cannot buy own listing");
    }

    if (paid < price) {
      throw new Revert("Insufficient payment amount");
    }
    if (this.getAgentOwner(agentId) !== this.address) {
      throw new Revert("Agent not in marketplace escrow");
    }

    this.activeByListing.set(listingIndex, false);
    this.activeByListing.save();
    this.listingByAgent.delete(agentId);
    this.activeListingCount.sub(u256.One);

    // TODO: transfer ownership from escrow to buyer.
    // TODO: settle royalty and seller proceeds.
    // TODO: reconcile `paid` against Blockchain.tx.outputs in this runtime.
    this.transferAgent(Blockchain.tx.sender, agentId);

    this.emitEvent(new ListingPurchasedEvent(listingId, paid));

    const writer = new BytesWriter(0);
    writer.writeU256(listingId);
    writer.writeU256(paid);
    return writer;
  }

  @method({ name: "listingId", type: "uint256" })
  @emit("ListingCancelled")
  public cancelListing(calldata: Calldata): BytesWriter {
    const listingId = calldata.readU256();
    const listingIndex = this.toListingIndex(listingId);
    const seller = this.sellerByListing.get(listingIndex);
    const agentId = this.agentByListing.get(listingIndex);

    if (!this.activeByListing.get(listingIndex)) {
      throw new Revert("Listing is inactive");
    }

    if (seller !== Blockchain.tx.sender) {
      throw new Revert("Only seller can cancel listing");
    }
    if (this.getAgentOwner(agentId) !== this.address) {
      throw new Revert("Agent not in marketplace escrow");
    }

    this.activeByListing.set(listingIndex, false);
    this.activeByListing.save();
    this.listingByAgent.delete(agentId);
    this.activeListingCount.sub(u256.One);

    // TODO: release escrow back to seller.
    this.transferAgent(seller, agentId);

    this.emitEvent(new ListingCancelledEvent(listingId));

    const writer = new BytesWriter(0);
    writer.writeU256(listingId);
    return writer;
  }

  @method()
  public totalListings(_calldata: Calldata): BytesWriter {
    const writer = new BytesWriter(0);
    writer.writeU256(this.nextListingId.value);
    return writer;
  }

  @method()
  public totalActiveListings(_calldata: Calldata): BytesWriter {
    const writer = new BytesWriter(0);
    writer.writeU256(this.activeListingCount.value);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public listingForAgent(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();

    const writer = new BytesWriter(0);
    writer.writeU256(this.listingByAgent.get(agentId));
    return writer;
  }

  @method({ name: "listingId", type: "uint256" })
  public getListing(calldata: Calldata): BytesWriter {
    const listingId = calldata.readU256();
    const listingIndex = this.toListingIndex(listingId);

    const writer = new BytesWriter(0);
    writer.writeU256(listingId);
    writer.writeU256(this.agentByListing.get(listingIndex));
    writer.writeAddress(this.sellerByListing.get(listingIndex));
    writer.writeU256(this.priceByListing.get(listingIndex));
    writer.writeBoolean(this.activeByListing.get(listingIndex));
    return writer;
  }

  private toListingIndex(listingId: u256): u32 {
    if (listingId <= u256.Zero) {
      throw new Revert("Invalid listing id");
    }

    const listingIndex = <u32>(listingId.toU64() - 1);
    if (listingIndex >= this.listingIds.getLength()) {
      throw new Revert("Listing not found");
    }

    return listingIndex;
  }

  private isActiveListing(listingId: u256): bool {
    return this.activeByListing.get(this.toListingIndex(listingId));
  }

  private getAgentContract(): Address {
    const agentContract = this.agentContract.value;
    if (agentContract === Address.zero()) {
      throw new Revert("Agent contract is not configured");
    }

    return agentContract;
  }

  private getAgentOwner(agentId: u256): Address {
    const calldata = new BytesWriter(36);
    calldata.writeSelector(encodeSelector("ownerOf(uint256)"));
    calldata.writeU256(agentId);

    const result = Blockchain.call(this.getAgentContract(), calldata, true);
    return result.data.readAddress();
  }

  private isAgentActive(agentId: u256): bool {
    const calldata = new BytesWriter(36);
    calldata.writeSelector(encodeSelector("isActiveAgent(uint256)"));
    calldata.writeU256(agentId);

    const result = Blockchain.call(this.getAgentContract(), calldata, true);
    return result.data.readBoolean();
  }

  private transferAgentFrom(from: Address, to: Address, agentId: u256): void {
    const calldata = new BytesWriter(104);
    calldata.writeSelector(encodeSelector("safeTransferFrom(address,address,uint256,bytes)"));
    calldata.writeAddress(from);
    calldata.writeAddress(to);
    calldata.writeU256(agentId);
    calldata.writeBytesWithLength(new Uint8Array(0));
    Blockchain.call(this.getAgentContract(), calldata, true);
  }

  private transferAgent(to: Address, agentId: u256): void {
    const calldata = new BytesWriter(72);
    calldata.writeSelector(encodeSelector("safeTransfer(address,uint256,bytes)"));
    calldata.writeAddress(to);
    calldata.writeU256(agentId);
    calldata.writeBytesWithLength(new Uint8Array(0));
    Blockchain.call(this.getAgentContract(), calldata, true);
  }
}
