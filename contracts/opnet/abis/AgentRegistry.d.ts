import { Address, AddressMap } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type AgentRegisteredEvent = {
    readonly agentId: bigint;
};
export type AgentDeregisteredEvent = {
    readonly agentId: bigint;
};
export type AgentUsageIncrementedEvent = {
    readonly agentId: bigint;
    readonly amount: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the register function call.
 */
export type Register = CallResult<{}, OPNetEvent<AgentRegisteredEvent>[]>;

/**
 * @description Represents the result of the deregister function call.
 */
export type Deregister = CallResult<{}, OPNetEvent<AgentDeregisteredEvent>[]>;

/**
 * @description Represents the result of the incrementUsage function call.
 */
export type IncrementUsage = CallResult<{}, OPNetEvent<AgentUsageIncrementedEvent>[]>;

/**
 * @description Represents the result of the isRegistered function call.
 */
export type IsRegistered = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the usageOf function call.
 */
export type UsageOf = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the registeredCount function call.
 */
export type RegisteredCount = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the agentIdAt function call.
 */
export type AgentIdAt = CallResult<{}, OPNetEvent<never>[]>;

// ------------------------------------------------------------------
// IAgentRegistry
// ------------------------------------------------------------------
export interface IAgentRegistry extends IOP_NETContract {
    register(agentId: bigint): Promise<Register>;
    deregister(agentId: bigint): Promise<Deregister>;
    incrementUsage(agentId: bigint, amount: bigint): Promise<IncrementUsage>;
    isRegistered(agentId: bigint): Promise<IsRegistered>;
    usageOf(agentId: bigint): Promise<UsageOf>;
    registeredCount(): Promise<RegisteredCount>;
    agentIdAt(index: number): Promise<AgentIdAt>;
}
