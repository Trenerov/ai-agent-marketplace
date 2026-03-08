import { Address, AddressMap } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type PaymentReceivedEvent = {
    readonly agentId: bigint;
    readonly amount: bigint;
};
export type EarningsClaimedEvent = {
    readonly agentId: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the configureAgentContract function call.
 */
export type ConfigureAgentContract = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the configureRegistryContract function call.
 */
export type ConfigureRegistryContract = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the pay function call.
 */
export type Pay = CallResult<{}, OPNetEvent<PaymentReceivedEvent>[]>;

/**
 * @description Represents the result of the claimEarnings function call.
 */
export type ClaimEarnings = CallResult<{}, OPNetEvent<EarningsClaimedEvent>[]>;

/**
 * @description Represents the result of the earningsOf function call.
 */
export type EarningsOf = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the totalPaidForAgent function call.
 */
export type TotalPaidForAgent = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the totalProtocolRevenue function call.
 */
export type TotalProtocolRevenue = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the totalReferralRevenue function call.
 */
export type TotalReferralRevenue = CallResult<{}, OPNetEvent<never>[]>;

// ------------------------------------------------------------------
// IUsagePayment
// ------------------------------------------------------------------
export interface IUsagePayment extends IOP_NETContract {
    configureAgentContract(agentContract: Address): Promise<ConfigureAgentContract>;
    configureRegistryContract(registryContract: Address): Promise<ConfigureRegistryContract>;
    pay(agentId: bigint, inputHash: string, amount: bigint): Promise<Pay>;
    claimEarnings(agentId: bigint): Promise<ClaimEarnings>;
    earningsOf(agentId: bigint): Promise<EarningsOf>;
    totalPaidForAgent(agentId: bigint): Promise<TotalPaidForAgent>;
    totalProtocolRevenue(): Promise<TotalProtocolRevenue>;
    totalReferralRevenue(): Promise<TotalReferralRevenue>;
}
