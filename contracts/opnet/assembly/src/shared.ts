import { u256 } from "@btc-vision/as-bignum/assembly";
import { Address } from "@btc-vision/btc-runtime/runtime";

export enum AgentCategory {
  Trading = 0,
  Content = 1,
  Code = 2,
  Data = 3,
  Support = 4,
  Creative = 5,
}

export const OWNER_SHARE_BPS: u16 = 8500;
export const PROTOCOL_SHARE_BPS: u16 = 1000;
export const REFERRAL_SHARE_BPS: u16 = 500;
export const DEFAULT_ROYALTY_BPS: u16 = 500;
export const BPS_DENOMINATOR: u16 = 10000;

export class AgentRecord {
  id: u256 = u256.Zero;
  owner: Address = Address.dead();
  creator: Address = Address.dead();
  promptHash: string = "";
  metadataURI: string = "";
  pricePerUse: u256 = u256.Zero;
  totalUses: u256 = u256.Zero;
  totalRevenue: u256 = u256.Zero;
  isActive: bool = true;
  createdAt: u256 = u256.Zero;
  category: u8 = 0;
  royaltyBps: u16 = DEFAULT_ROYALTY_BPS;
}

export class ListingRecord {
  listingId: u256 = u256.Zero;
  agentId: u256 = u256.Zero;
  seller: Address = Address.dead();
  price: u256 = u256.Zero;
  isActive: bool = true;
  createdAt: u256 = u256.Zero;
}
