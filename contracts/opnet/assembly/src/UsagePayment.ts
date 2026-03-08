import { u256 } from "@btc-vision/as-bignum/assembly";
import {
  Address,
  Blockchain,
  BytesWriter,
  Calldata,
  OP_NET,
  Revert,
  SafeMath,
  StoredAddress,
  StoredMapU256,
  StoredU256,
  encodeSelector,
} from "@btc-vision/btc-runtime/runtime";
import { EMPTY_POINTER } from "@btc-vision/btc-runtime/runtime/math/bytes";
import { EarningsClaimedEvent, PaymentReceivedEvent } from "./events";
import {
  BPS_DENOMINATOR,
  OWNER_SHARE_BPS,
  PROTOCOL_SHARE_BPS,
  REFERRAL_SHARE_BPS,
} from "./shared";

@final
export class UsagePayment extends OP_NET {
  private readonly agentContractPointer: u16 = Blockchain.nextPointer;
  private readonly registryContractPointer: u16 = Blockchain.nextPointer;
  private readonly earningsPointer: u16 = Blockchain.nextPointer;
  private readonly paidByAgentPointer: u16 = Blockchain.nextPointer;
  private readonly protocolRevenuePointer: u16 = Blockchain.nextPointer;
  private readonly referralRevenuePointer: u16 = Blockchain.nextPointer;

  private readonly agentContract!: StoredAddress;
  private readonly registryContract!: StoredAddress;
  private readonly earningsByAgent!: StoredMapU256;
  private readonly paidByAgent!: StoredMapU256;
  private readonly protocolRevenue!: StoredU256;
  private readonly referralRevenue!: StoredU256;

  public constructor() {
    super();
    this.agentContract = new StoredAddress(this.agentContractPointer);
    this.registryContract = new StoredAddress(this.registryContractPointer);
    this.earningsByAgent = new StoredMapU256(this.earningsPointer);
    this.paidByAgent = new StoredMapU256(this.paidByAgentPointer);
    this.protocolRevenue = new StoredU256(this.protocolRevenuePointer, EMPTY_POINTER);
    this.referralRevenue = new StoredU256(this.referralRevenuePointer, EMPTY_POINTER);
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

  @method({ name: "registryContract", type: "address" })
  public configureRegistryContract(calldata: Calldata): BytesWriter {
    this.onlyDeployer(Blockchain.tx.sender);
    this.registryContract.value = calldata.readAddress();
    return new BytesWriter(0);
  }

  @method(
    { name: "agentId", type: "uint256" },
    { name: "inputHash", type: "string" },
    { name: "amount", type: "uint256" }
  )
  @emit("PaymentReceived")
  public pay(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const inputHash = calldata.readStringWithLength();
    const amount = calldata.readU256();

    if (amount <= u256.Zero) {
      throw new Revert("Payment amount must be positive");
    }
    if (!this.isAgentActive(agentId)) {
      throw new Revert("Agent is inactive");
    }
    if (amount < this.getAgentPrice(agentId)) {
      throw new Revert("Amount below agent price");
    }

    const ownerShare = this.split(amount, OWNER_SHARE_BPS);
    const protocolShare = this.split(amount, PROTOCOL_SHARE_BPS);
    const referralShare = this.split(amount, REFERRAL_SHARE_BPS);

    // TODO: reconcile `amount` against Blockchain.tx.outputs in this runtime.
    // TODO: emit execution event for off-chain AI engine.

    this.earningsByAgent.set(
      agentId,
      SafeMath.add(this.earningsByAgent.get(agentId), ownerShare)
    );
    this.paidByAgent.set(agentId, SafeMath.add(this.paidByAgent.get(agentId), amount));
    this.protocolRevenue.add(protocolShare);
    this.referralRevenue.add(referralShare);
    this.recordAgentUsage(agentId, amount);
    this.incrementRegistryUsage(agentId);

    this.emitEvent(new PaymentReceivedEvent(agentId, amount));

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    writer.writeString(inputHash);
    writer.writeU256(amount);
    writer.writeU256(ownerShare);
    writer.writeU256(protocolShare);
    writer.writeU256(referralShare);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  @emit("EarningsClaimed")
  public claimEarnings(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const claimed = this.earningsByAgent.get(agentId);

    if (u256.eq(claimed, u256.Zero)) {
      throw new Revert("No earnings to claim");
    }
    if (this.getAgentOwner(agentId) !== Blockchain.tx.sender) {
      throw new Revert("Only current owner can claim earnings");
    }

    this.earningsByAgent.delete(agentId);

    // TODO: transfer accrued owner earnings to the current owner.

    this.emitEvent(new EarningsClaimedEvent(agentId));

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    writer.writeU256(claimed);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public earningsOf(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();

    const writer = new BytesWriter(0);
    writer.writeU256(this.earningsByAgent.get(agentId));
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public totalPaidForAgent(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();

    const writer = new BytesWriter(0);
    writer.writeU256(this.paidByAgent.get(agentId));
    return writer;
  }

  @method()
  public totalProtocolRevenue(_calldata: Calldata): BytesWriter {
    const writer = new BytesWriter(0);
    writer.writeU256(this.protocolRevenue.value);
    return writer;
  }

  @method()
  public totalReferralRevenue(_calldata: Calldata): BytesWriter {
    const writer = new BytesWriter(0);
    writer.writeU256(this.referralRevenue.value);
    return writer;
  }

  private split(amount: u256, bps: u16): u256 {
    return SafeMath.div(
      SafeMath.mul(amount, u256.fromU64(bps)),
      u256.fromU64(BPS_DENOMINATOR)
    );
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

  private getAgentPrice(agentId: u256): u256 {
    const calldata = new BytesWriter(36);
    calldata.writeSelector(encodeSelector("priceOf(uint256)"));
    calldata.writeU256(agentId);

    const result = Blockchain.call(this.getAgentContract(), calldata, true);
    return result.data.readU256();
  }

  private isAgentActive(agentId: u256): bool {
    const calldata = new BytesWriter(36);
    calldata.writeSelector(encodeSelector("isActiveAgent(uint256)"));
    calldata.writeU256(agentId);

    const result = Blockchain.call(this.getAgentContract(), calldata, true);
    return result.data.readBoolean();
  }

  private recordAgentUsage(agentId: u256, amount: u256): void {
    const calldata = new BytesWriter(100);
    calldata.writeSelector(encodeSelector("recordUsage(uint256,uint256,uint256)"));
    calldata.writeU256(agentId);
    calldata.writeU256(u256.One);
    calldata.writeU256(amount);
    Blockchain.call(this.getAgentContract(), calldata, true);
  }

  private incrementRegistryUsage(agentId: u256): void {
    const registry = this.registryContract.value;
    if (registry === Address.zero()) {
      return;
    }

    const calldata = new BytesWriter(68);
    calldata.writeSelector(encodeSelector("incrementUsage(uint256,uint256)"));
    calldata.writeU256(agentId);
    calldata.writeU256(u256.One);
    Blockchain.call(registry, calldata, true);
  }
}
