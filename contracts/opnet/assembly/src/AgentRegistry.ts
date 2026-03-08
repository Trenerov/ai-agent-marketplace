import {
  Blockchain,
  BytesWriter,
  Calldata,
  OP_NET,
  Revert,
  SafeMath,
  StoredMapU256,
  StoredU256,
  StoredU256Array,
} from "@btc-vision/btc-runtime/runtime";
import { u256 } from "@btc-vision/as-bignum/assembly";
import { EMPTY_POINTER } from "@btc-vision/btc-runtime/runtime/math/bytes";
import {
  AgentDeregisteredEvent,
  AgentRegisteredEvent,
  AgentUsageIncrementedEvent,
} from "./events";

@final
export class AgentRegistry extends OP_NET {
  private readonly registeredPointer: u16 = Blockchain.nextPointer;
  private readonly usagePointer: u16 = Blockchain.nextPointer;
  private readonly seenPointer: u16 = Blockchain.nextPointer;
  private readonly activeCountPointer: u16 = Blockchain.nextPointer;
  private readonly agentIdsPointer: u16 = Blockchain.nextPointer;

  private readonly registered!: StoredMapU256;
  private readonly usage!: StoredMapU256;
  private readonly seen!: StoredMapU256;
  private readonly activeCount!: StoredU256;
  private readonly agentIds!: StoredU256Array;

  public constructor() {
    super();
    this.registered = new StoredMapU256(this.registeredPointer);
    this.usage = new StoredMapU256(this.usagePointer);
    this.seen = new StoredMapU256(this.seenPointer);
    this.activeCount = new StoredU256(this.activeCountPointer, EMPTY_POINTER);
    this.agentIds = new StoredU256Array(this.agentIdsPointer, EMPTY_POINTER);
  }

  @method({ name: "agentId", type: "uint256" })
  @emit("AgentRegistered")
  public register(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();

    if (this.isRegisteredInternal(agentId)) {
      throw new Revert("Agent already registered");
    }

    this.registered.set(agentId, u256.One);
    this.activeCount.add(u256.One);

    if (u256.eq(this.seen.get(agentId), u256.Zero)) {
      this.agentIds.push(agentId);
      this.agentIds.save();
      this.seen.set(agentId, u256.One);
    }

    this.emitEvent(new AgentRegisteredEvent(agentId));

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  @emit("AgentDeregistered")
  public deregister(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();

    if (!this.isRegisteredInternal(agentId)) {
      throw new Revert("Agent is not registered");
    }

    this.registered.delete(agentId);
    this.activeCount.sub(u256.One);

    this.emitEvent(new AgentDeregisteredEvent(agentId));

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    return writer;
  }

  @method(
    { name: "agentId", type: "uint256" },
    { name: "amount", type: "uint256" }
  )
  @emit("AgentUsageIncremented")
  public incrementUsage(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();
    const amount = calldata.readU256();

    if (!this.isRegisteredInternal(agentId)) {
      throw new Revert("Agent is not registered");
    }

    this.usage.set(agentId, SafeMath.add(this.usage.get(agentId), amount));

    this.emitEvent(new AgentUsageIncrementedEvent(agentId, amount));

    const writer = new BytesWriter(0);
    writer.writeU256(agentId);
    writer.writeU256(amount);
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public isRegistered(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();

    const writer = new BytesWriter(0);
    writer.writeBoolean(this.isRegisteredInternal(agentId));
    return writer;
  }

  @method({ name: "agentId", type: "uint256" })
  public usageOf(calldata: Calldata): BytesWriter {
    const agentId = calldata.readU256();

    const writer = new BytesWriter(0);
    writer.writeU256(this.usage.get(agentId));
    return writer;
  }

  @method()
  public registeredCount(_calldata: Calldata): BytesWriter {
    const writer = new BytesWriter(0);
    writer.writeU256(this.activeCount.value);
    return writer;
  }

  @method({ name: "index", type: "uint32" })
  public agentIdAt(calldata: Calldata): BytesWriter {
    const index = calldata.readU32();

    if (index >= this.agentIds.getLength()) {
      throw new Revert("Index out of range");
    }

    const writer = new BytesWriter(0);
    writer.writeU256(this.agentIds.get(index));
    return writer;
  }

  private isRegisteredInternal(agentId: u256): bool {
    return !u256.eq(this.registered.get(agentId), u256.Zero);
  }
}
