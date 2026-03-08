import { Address, AddressMap } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type ListingCreatedEvent = {
    readonly agentId: bigint;
    readonly price: bigint;
};
export type ListingPurchasedEvent = {
    readonly listingId: bigint;
    readonly amount: bigint;
};
export type ListingCancelledEvent = {
    readonly listingId: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the configureAgentContract function call.
 */
export type ConfigureAgentContract = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the list function call.
 */
export type List = CallResult<{}, OPNetEvent<ListingCreatedEvent>[]>;

/**
 * @description Represents the result of the buy function call.
 */
export type Buy = CallResult<{}, OPNetEvent<ListingPurchasedEvent>[]>;

/**
 * @description Represents the result of the cancelListing function call.
 */
export type CancelListing = CallResult<{}, OPNetEvent<ListingCancelledEvent>[]>;

/**
 * @description Represents the result of the totalListings function call.
 */
export type TotalListings = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the totalActiveListings function call.
 */
export type TotalActiveListings = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the listingForAgent function call.
 */
export type ListingForAgent = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the getListing function call.
 */
export type GetListing = CallResult<{}, OPNetEvent<never>[]>;

// ------------------------------------------------------------------
// IMarketplace
// ------------------------------------------------------------------
export interface IMarketplace extends IOP_NETContract {
    configureAgentContract(agentContract: Address): Promise<ConfigureAgentContract>;
    list(agentId: bigint, price: bigint): Promise<List>;
    buy(listingId: bigint, amount: bigint): Promise<Buy>;
    cancelListing(listingId: bigint): Promise<CancelListing>;
    totalListings(): Promise<TotalListings>;
    totalActiveListings(): Promise<TotalActiveListings>;
    listingForAgent(agentId: bigint): Promise<ListingForAgent>;
    getListing(listingId: bigint): Promise<GetListing>;
}
