import { onchainTable, relations } from "ponder";

// Main builders projects table - matches GraphQL BuildersProject entity
export const buildersProject = onchainTable("builders_project", (t) => ({
  id: t.hex().primaryKey(), // builderPoolId (bytes32)
  name: t.text().notNull(),
  admin: t.hex().notNull(), // Administrator address
  totalStaked: t.bigint().notNull().default(0n),
  totalUsers: t.integer().notNull().default(0),
  totalClaimed: t.bigint().notNull().default(0n),
  minimalDeposit: t.bigint().notNull(),
  withdrawLockPeriodAfterDeposit: t.bigint().notNull(), // Lock period in seconds
  claimLockEnd: t.bigint().notNull(), // Claim lock end timestamp
  startsAt: t.bigint().notNull(), // Pool start timestamp
  chainId: t.integer().notNull(), // Track which chain this project is on
  contractAddress: t.hex().notNull(), // Builders contract address
  createdAt: t.integer().notNull(), // Block timestamp when created
  createdAtBlock: t.bigint().notNull(), // Block number when created
  // Metadata fields
  slug: t.text(), // Subnet slug/identifier
  description: t.text(), // Subnet description
  website: t.text(), // Subnet website URL
  image: t.text(), // Subnet image URL
}));

// Builders users table - matches GraphQL BuildersUser entity
export const buildersUser = onchainTable("builders_user", (t) => ({
  id: t.text().primaryKey(), // Composite: `${projectId}-${address}`
  buildersProjectId: t.hex().notNull(), // Foreign key reference handled via relations
  address: t.hex().notNull(), // User address
  staked: t.bigint().notNull().default(0n), // Current staked amount
  claimed: t.bigint().notNull().default(0n), // Total claimed amount
  lastStake: t.bigint().notNull().default(0n), // Timestamp of last stake
  claimLockEnd: t.bigint().notNull().default(0n), // When user can claim
  lastDeposit: t.bigint().notNull().default(0n), // Last deposit timestamp
  virtualDeposited: t.bigint().notNull().default(0n), // Virtual deposited amount
  chainId: t.integer().notNull(),
}));

// Transaction events for detailed history
export const stakingEvent = onchainTable("staking_event", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  buildersProjectId: t.hex().notNull(), // Foreign key reference handled via relations
  userAddress: t.hex().notNull(),
  eventType: t.text().notNull(), // 'DEPOSIT', 'WITHDRAW', 'CLAIM'
  amount: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.integer().notNull(),
  transactionHash: t.hex().notNull(),
  logIndex: t.integer().notNull(),
  chainId: t.integer().notNull(),
}));

// MOR token transfers relevant to builders
export const morTransfer = onchainTable("mor_transfer", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  from: t.hex().notNull(),
  to: t.hex().notNull(),
  value: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.integer().notNull(),
  transactionHash: t.hex().notNull(),
  logIndex: t.integer().notNull(),
  chainId: t.integer().notNull(),
  // Flags to identify if this transfer is related to builders staking
  isStakingDeposit: t.boolean().notNull().default(false),
  isStakingWithdraw: t.boolean().notNull().default(false),
  relatedProjectId: t.hex(), // Reference to builders project if relevant
}));

// Factory-created subnets and dynamic contracts
export const dynamicSubnet = onchainTable("dynamic_subnet", (t) => ({
  id: t.hex().primaryKey(), // Subnet contract address
  creator: t.hex().notNull(),
  factoryAddress: t.hex().notNull(),
  creationSalt: t.hex().notNull(),
  createdAt: t.integer().notNull(),
  createdAtBlock: t.bigint().notNull(),
  chainId: t.integer().notNull(),
}));

// Reward distributions from BuildersTreasuryV2
export const rewardDistribution = onchainTable("reward_distribution", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  receiver: t.hex().notNull(), // Address receiving the reward
  amount: t.bigint().notNull(), // Reward amount distributed
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.integer().notNull(),
  transactionHash: t.hex().notNull(),
  logIndex: t.integer().notNull(),
  chainId: t.integer().notNull(),
  treasuryAddress: t.hex().notNull(), // BuildersTreasuryV2 contract address
}));

// Global counters - matches GraphQL counters entity
export const counters = onchainTable("counters", (t) => ({
  id: t.text().primaryKey().default("global"), // Single row
  totalBuildersProjects: t.integer().notNull().default(0),
  totalSubnets: t.integer().notNull().default(0),
  totalStaked: t.bigint().notNull().default(0n), // Total across all projects
  totalUsers: t.integer().notNull().default(0), // Unique users across all projects
  lastUpdated: t.integer().notNull(),
}));

// Define relationships between tables
// Note: Ponder doesn't support foreign key constraints at the database level
// Relations are defined for GraphQL API purposes only
export const buildersProjectRelations = relations(buildersProject, ({ many }) => ({
  users: many(buildersUser),
  events: many(stakingEvent),
}));

export const buildersUserRelations = relations(buildersUser, ({ one }) => ({
  project: one(buildersProject, {
    fields: [buildersUser.buildersProjectId],
    references: [buildersProject.id],
  }),
}));

export const stakingEventRelations = relations(stakingEvent, ({ one }) => ({
  project: one(buildersProject, {
    fields: [stakingEvent.buildersProjectId],
    references: [buildersProject.id],
  }),
}));

export const morTransferRelations = relations(morTransfer, ({ one }) => ({
  relatedProject: one(buildersProject, {
    fields: [morTransfer.relatedProjectId],
    references: [buildersProject.id],
  }),
}));
