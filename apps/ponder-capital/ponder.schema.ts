import { onchainTable, relations } from "ponder";

// Main DepositPool entity - matches existing subgraph exactly
export const depositPool = onchainTable("DepositPool", (t) => ({
  id: t.hex().primaryKey(), // rewardPoolId + depositPool (matching existing logic)
  rewardPoolId: t.bigint().notNull(),
  depositPool: t.hex().notNull(), // contract address  
  totalStaked: t.bigint().notNull().default(0n),
}));

// User entity - matches existing subgraph exactly
export const user = onchainTable("User", (t) => ({
  id: t.hex().primaryKey(), // userAddress + rewardPoolId + depositPool
  address: t.hex().notNull(),
  rewardPoolId: t.bigint().notNull(),
  depositPool: t.hex().notNull(),
  staked: t.bigint().notNull().default(0n),
  claimed: t.bigint().notNull().default(0n),
}));

// PoolInteraction entity - immutable interaction records
export const poolInteraction = onchainTable("PoolInteraction", (t) => ({
  id: t.hex().primaryKey(), // txHash + counter
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(), // BigInt in subgraph
  transactionHash: t.hex().notNull(),
  user: t.hex().notNull(), // Foreign key handled by relations
  type: t.bigint().notNull(), // 0=STAKE, 1=WITHDRAW, 2=CLAIM
  amount: t.bigint().notNull(),
  depositPool: t.hex().notNull(),
  totalStaked: t.bigint().notNull(),
  rate: t.bigint().notNull(),
}));

// Helper entity for interaction counting
export const interactionCount = onchainTable("InteractionCount", (t) => ({
  id: t.hex().primaryKey(), // transaction hash
  count: t.bigint().notNull().default(0n),
}));

// Referral system entities
export const referrer = onchainTable("Referrer", (t) => ({
  id: t.hex().primaryKey(), // same as user.id
  userId: t.hex().notNull(), // Foreign key handled by relations
  referrerAddress: t.hex().notNull(),
  claimed: t.bigint().notNull().default(0n),
}));

export const referral = onchainTable("Referral", (t) => ({
  id: t.hex().primaryKey(), // referralUser.id + referrer.id
  referral: t.hex().notNull(), // Foreign key handled by relations
  referrer: t.hex().notNull(), // Foreign key handled by relations
  referralAddress: t.hex().notNull(),
  referrerAddress: t.hex().notNull(),
  amount: t.bigint().notNull(),
}));

// Proxy contract events (immutable) - exactly matching subgraph
export const adminChanged = onchainTable("AdminChanged", (t) => ({
  id: t.hex().primaryKey(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
  previousAdmin: t.hex().notNull(),
  newAdmin: t.hex().notNull(),
  depositPool: t.hex().notNull(),
}));

export const beaconUpgraded = onchainTable("BeaconUpgraded", (t) => ({
  id: t.hex().primaryKey(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
  beacon: t.hex().notNull(),
  depositPool: t.hex().notNull(),
}));

export const initialized = onchainTable("Initialized", (t) => ({
  id: t.hex().primaryKey(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
  version: t.integer().notNull(),
  depositPool: t.hex().notNull(),
}));

export const upgraded = onchainTable("Upgraded", (t) => ({
  id: t.hex().primaryKey(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
  implementation: t.hex().notNull(),
  depositPool: t.hex().notNull(),
}));

export const ownershipTransferred = onchainTable("OwnershipTransferred", (t) => ({
  id: t.hex().primaryKey(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
  previousOwner: t.hex().notNull(),
  newOwner: t.hex().notNull(),
  depositPool: t.hex().notNull(),
}));

// Define relationships between tables - matching subgraph @derivedFrom behavior
export const userRelations = relations(user, ({ many, one }) => ({
  interactions: many(poolInteraction),
  referrerProfile: one(referrer, {
    fields: [user.id],
    references: [referrer.userId],
  }),
}));

export const poolInteractionRelations = relations(poolInteraction, ({ one }) => ({
  user: one(user, {
    fields: [poolInteraction.user], // Updated field reference
    references: [user.id],
  }),
}));

export const referrerRelations = relations(referrer, ({ one, many }) => ({
  user: one(user, {
    fields: [referrer.userId],
    references: [user.id],
  }),
  referrals: many(referral),
}));

export const referralRelations = relations(referral, ({ one }) => ({
  referralUser: one(user, {
    fields: [referral.referral], // Updated field reference
    references: [user.id],
  }),
  referrerEntity: one(referrer, {
    fields: [referral.referrer], // Updated field reference
    references: [referrer.id],
  }),
}));