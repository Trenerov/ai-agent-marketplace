import { Address, AddressMap } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type AgentMintedEvent = {
    readonly tokenId: bigint;
    readonly pricePerUse: bigint;
    readonly category: number;
    readonly royaltyBps: number;
};
export type AgentPriceUpdatedEvent = {
    readonly agentId: bigint;
    readonly newPrice: bigint;
};
export type AgentToggledEvent = {
    readonly agentId: bigint;
};
export type AgentMetadataUpdatedEvent = {
    readonly agentId: bigint;
    readonly metadataURI: string;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the mint function call.
 */
export type Mint = CallResult<{}, OPNetEvent<AgentMintedEvent>[]>;

/**
 * @description Represents the result of the updatePrice function call.
 */
export type UpdatePrice = CallResult<{}, OPNetEvent<AgentPriceUpdatedEvent>[]>;

/**
 * @description Represents the result of the toggleActive function call.
 */
export type ToggleActive = CallResult<{}, OPNetEvent<AgentToggledEvent>[]>;

/**
 * @description Represents the result of the updateMetadata function call.
 */
export type UpdateMetadata = CallResult<{}, OPNetEvent<AgentMetadataUpdatedEvent>[]>;

/**
 * @description Represents the result of the getAgent function call.
 */
export type GetAgent = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the priceOf function call.
 */
export type PriceOf = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the promptHashOf function call.
 */
export type PromptHashOf = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the isActiveAgent function call.
 */
export type IsActiveAgent = CallResult<{}, OPNetEvent<never>[]>;

/**
 * @description Represents the result of the recordUsage function call.
 */
export type RecordUsage = CallResult<{}, OPNetEvent<never>[]>;

// ------------------------------------------------------------------
// IAgentNFT
// ------------------------------------------------------------------
export interface IAgentNFT extends IOP_NETContract {
    mint(
        promptHash: string,
        metadataURI: string,
        pricePerUse: bigint,
        category: number,
        royaltyBps: number,
    ): Promise<Mint>;
    updatePrice(agentId: bigint, newPrice: bigint): Promise<UpdatePrice>;
    toggleActive(agentId: bigint): Promise<ToggleActive>;
    updateMetadata(agentId: bigint, metadataURI: string): Promise<UpdateMetadata>;
    getAgent(agentId: bigint): Promise<GetAgent>;
    priceOf(agentId: bigint): Promise<PriceOf>;
    promptHashOf(agentId: bigint): Promise<PromptHashOf>;
    isActiveAgent(agentId: bigint): Promise<IsActiveAgent>;
    recordUsage(agentId: bigint, usageDelta: bigint, revenueDelta: bigint): Promise<RecordUsage>;
}
