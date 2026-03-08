import { u256 } from "@btc-vision/as-bignum/assembly";
import {
  BytesWriter,
  NetEvent,
  U16_BYTE_LENGTH,
  U256_BYTE_LENGTH,
  U32_BYTE_LENGTH,
  U8_BYTE_LENGTH,
} from "@btc-vision/btc-runtime/runtime";

@final
export class AgentMintedEvent extends NetEvent {
  public constructor(
    tokenId: u256,
    pricePerUse: u256,
    category: u8,
    royaltyBps: u16
  ) {
    const data = new BytesWriter(
      U256_BYTE_LENGTH + U256_BYTE_LENGTH + U8_BYTE_LENGTH + U16_BYTE_LENGTH
    );
    data.writeU256(tokenId);
    data.writeU256(pricePerUse);
    data.writeU8(category);
    data.writeU16(royaltyBps);
    super("AgentMinted", data);
  }
}

@final
export class AgentPriceUpdatedEvent extends NetEvent {
  public constructor(agentId: u256, newPrice: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH + U256_BYTE_LENGTH);
    data.writeU256(agentId);
    data.writeU256(newPrice);
    super("AgentPriceUpdated", data);
  }
}

@final
export class AgentToggledEvent extends NetEvent {
  public constructor(agentId: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH);
    data.writeU256(agentId);
    super("AgentToggled", data);
  }
}

@final
export class AgentMetadataUpdatedEvent extends NetEvent {
  public constructor(agentId: u256, metadataURI: string) {
    const uriBytes = String.UTF8.encode(metadataURI);
    const data = new BytesWriter(U256_BYTE_LENGTH + U32_BYTE_LENGTH + uriBytes.byteLength);
    data.writeU256(agentId);
    data.writeStringWithLength(metadataURI);
    super("AgentMetadataUpdated", data);
  }
}

@final
export class PaymentReceivedEvent extends NetEvent {
  public constructor(agentId: u256, amount: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH + U256_BYTE_LENGTH);
    data.writeU256(agentId);
    data.writeU256(amount);
    super("PaymentReceived", data);
  }
}

@final
export class EarningsClaimedEvent extends NetEvent {
  public constructor(agentId: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH);
    data.writeU256(agentId);
    super("EarningsClaimed", data);
  }
}

@final
export class AgentRegisteredEvent extends NetEvent {
  public constructor(agentId: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH);
    data.writeU256(agentId);
    super("AgentRegistered", data);
  }
}

@final
export class AgentDeregisteredEvent extends NetEvent {
  public constructor(agentId: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH);
    data.writeU256(agentId);
    super("AgentDeregistered", data);
  }
}

@final
export class AgentUsageIncrementedEvent extends NetEvent {
  public constructor(agentId: u256, amount: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH + U256_BYTE_LENGTH);
    data.writeU256(agentId);
    data.writeU256(amount);
    super("AgentUsageIncremented", data);
  }
}

@final
export class ListingCreatedEvent extends NetEvent {
  public constructor(agentId: u256, price: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH + U256_BYTE_LENGTH);
    data.writeU256(agentId);
    data.writeU256(price);
    super("ListingCreated", data);
  }
}

@final
export class ListingPurchasedEvent extends NetEvent {
  public constructor(listingId: u256, amount: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH + U256_BYTE_LENGTH);
    data.writeU256(listingId);
    data.writeU256(amount);
    super("ListingPurchased", data);
  }
}

@final
export class ListingCancelledEvent extends NetEvent {
  public constructor(listingId: u256) {
    const data = new BytesWriter(U256_BYTE_LENGTH);
    data.writeU256(listingId);
    super("ListingCancelled", data);
  }
}
