# Ponder Capital Indexer Implementation Plan

## Overview
This document outlines the comprehensive implementation plan for migrating the existing Morpheus Capital subgraph to Ponder indexing framework. The migration will maintain full compatibility with existing GraphQL queries while providing enhanced performance and reliability.

## Current Subgraph Analysis

### **Existing Contract Addresses & Start Blocks**
- **DepositPool_stETH**: `0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790` (Block: 19,178,638)
- **DepositPool_wBTC**: `0xdE283F8309Fd1AA46c95d299f6B8310716277A42` (Block: 23,390,320)
- **DepositPool_wETH**: `0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384` (Block: 23,390,320)
- **DepositPool_USDC**: `0x6cCE082851Add4c535352f596662521B4De4750E` (Block: 23,390,320)
- **DepositPool_USDT**: `0x3B51989212BEdaB926794D6bf8e9E991218cf116` (Block: 23,390,320)

### **Key Events Being Tracked**
- `UserStaked(indexed uint256 rewardPoolIndex, indexed address user, uint256 amount)`
- `UserWithdrawn(indexed uint256 rewardPoolIndex, indexed address user, uint256 amount)`
- `UserClaimed(indexed uint256 rewardPoolIndex, indexed address user, address receiver, uint256 amount)`
- `UserReferred(indexed uint256 rewardPoolIndex, indexed address referral, indexed address referrer, uint256 amount)`
- `ReferrerClaimed(indexed uint256 rewardPoolIndex, indexed address referrer, address receiver, uint256 amount)`
- Proxy contract events: `AdminChanged`, `BeaconUpgraded`, `Initialized`, `Upgraded`, `OwnershipTransferred`

### **Current Entity Structure**
```graphql
type DepositPool @entity {
  id: Bytes!                    # rewardPoolId + depositPool address
  rewardPoolId: BigInt!
  depositPool: Bytes!           # contract address
  totalStaked: BigInt!
}

type User @entity {
  id: Bytes!                    # userAddress + rewardPoolId + depositPool
  address: Bytes!
  rewardPoolId: BigInt!
  depositPool: Bytes!
  staked: BigInt!
  claimed: BigInt!
  interactions: [PoolInteraction!]! @derivedFrom(field: "user")
}

type PoolInteraction @entity(immutable: true) {
  id: Bytes!                    # txHash + counter
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
  user: User!
  type: BigInt!                 # 0=STAKE, 1=WITHDRAW, 2=CLAIM
  amount: BigInt!
  depositPool: Bytes!
  totalStaked: BigInt!
  rate: BigInt!
}

type Referral @entity {
  id: Bytes!                    # referralUser.id + referrer.id
  referral: User!
  referrer: Referrer!
  referralAddress: Bytes!
  referrerAddress: Bytes!
  amount: BigInt!
}

type Referrer @entity {
  id: Bytes!                    # same as user.id
  user: User!
  referrerAddress: Bytes!
  claimed: BigInt!
  referrals: [Referral!]! @derivedFrom(field: "referrer")
}
```

---

## Implementation Plan

### **Phase 1: Project Setup & ABIs (Day 1)**

#### **1.1 Create ponder-capital directory structure**
```
apps/ponder-capital/
├── abis/
│   ├── DepositPoolAbi.ts
│   ├── DistributorAbi.ts  
│   ├── L1SenderV2Abi.ts
│   ├── ChainLinkDataConsumerAbi.ts
│   ├── RewardPoolAbi.ts
│   └── L2MessageReceiverAbi.ts
├── src/
│   ├── api/
│   │   └── index.ts
│   └── index.ts
├── ponder.config.ts
├── ponder.schema.ts
├── package.json
├── tsconfig.json
└── ponder-env.d.ts
```

#### **1.2 Extract and create contract ABIs**
- ✅ Extract DepositPool ABI from `Subgraph/abis/DepositPool.json`
- Extract additional ABIs from Etherscan data for distribution contracts:
  - **L1SenderV2**: `0x50e80ea310269c547b64cc8b8a606be0ec467d1f`
  - **ChainLinkDataConsumer**: `0x94e6720a624ea275b44d357a7f21bfcf09ff7e11`
  - **RewardPool**: `0xe30279b79392aeff7fdf1883c23d52eba9d88a75`
  - **Distributor**: `0x5b660ab78f3ac743953f9e68630a2d66e7b45f64`
- Get L2MessageReceiver ABI from Arbitrum: `0xd4a8ECcBe696295e68572A98b1aA70Aa9277d427`

#### **1.3 Update shared ABIs package**
- Add capital contract ABIs to `packages/shared-abis/src/`
- Update `packages/shared-abis/src/index.ts` to export capital ABIs
- Add capital contract addresses to `CONTRACT_ADDRESSES` config

### **Phase 2: Ponder Configuration (Day 2)**

#### **2.1 Create ponder.config.ts**
Based on existing subgraph configuration:

```typescript
import { createConfig } from "ponder";
import { DepositPoolAbi, DistributorAbi, L1SenderV2Abi, L2MessageReceiverAbi } from "../../packages/shared-abis/src/index.js";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1!,
    },
    arbitrum: {
      id: 42161, 
      rpc: process.env.PONDER_RPC_URL_42161!,
    },
  },
  contracts: {
    // Deposit Pool Contracts - Each token has its own pool
    DepositPoolStETH: {
      abi: DepositPoolAbi,
      chain: "mainnet",
      address: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790",
      startBlock: 19178638,
      includeTransactionReceipts: true,
    },
    DepositPoolWBTC: {
      abi: DepositPoolAbi,
      chain: "mainnet", 
      address: "0xdE283F8309Fd1AA46c95d299f6B8310716277A42",
      startBlock: 23390320,
      includeTransactionReceipts: true,
    },
    DepositPoolWETH: {
      abi: DepositPoolAbi,
      chain: "mainnet",
      address: "0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384", 
      startBlock: 23390320,
      includeTransactionReceipts: true,
    },
    DepositPoolUSDC: {
      abi: DepositPoolAbi,
      chain: "mainnet",
      address: "0x6cCE082851Add4c535352f596662521B4De4750E",
      startBlock: 23390320,
      includeTransactionReceipts: true,
    },
    DepositPoolUSDT: {
      abi: DepositPoolAbi,
      chain: "mainnet",
      address: "0x3B51989212BEdaB926794D6bf8e9E991218cf116",
      startBlock: 23390320,
      includeTransactionReceipts: true,
    },
    
    // Core distribution contracts (from deployed contracts documentation)
    Distributor: {
      abi: DistributorAbi,
      chain: "mainnet",
      address: "0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A", // Main distributor
      startBlock: 20000000, // TBD - need to find actual deployment block
      includeTransactionReceipts: true,
    },
    
    L1SenderV2: {
      abi: L1SenderV2Abi,
      chain: "mainnet", 
      address: "0x50e80ea310269c547b64cc8b8a606be0ec467d1f",
      startBlock: 20000000, // TBD
    },
    
    // L2 components
    L2MessageReceiver: {
      abi: L2MessageReceiverAbi, 
      chain: "arbitrum",
      address: "0xd4a8ECcBe696295e68572A98b1aA70Aa9277d427",
      startBlock: 18000000, // TBD
    },
  },
});
```

#### **2.2 Assess factory pattern necessity**
- Review if new DepositPools are created dynamically
- Current subgraph tracks 5 fixed pools, so factory pattern may not be needed
- Monitor for pool creation events in future iterations

### **Phase 3: Schema Design (Day 3)**

#### **3.1 Ponder schema matching existing subgraph entities**

```typescript
import { onchainTable, relations } from "ponder";

// Main DepositPool entity - matches existing subgraph
export const depositPool = onchainTable("deposit_pool", (t) => ({
  id: t.hex().primaryKey(), // rewardPoolId + depositPool (matching existing logic)
  rewardPoolId: t.bigint().notNull(),
  depositPool: t.hex().notNull(), // contract address  
  totalStaked: t.bigint().notNull().default(0n),
  chainId: t.integer().notNull().default(1),
}));

// User entity - matches existing subgraph  
export const user = onchainTable("user", (t) => ({
  id: t.hex().primaryKey(), // userAddress + rewardPoolId + depositPool
  address: t.hex().notNull(),
  rewardPoolId: t.bigint().notNull(),
  depositPool: t.hex().notNull(),
  staked: t.bigint().notNull().default(0n),
  claimed: t.bigint().notNull().default(0n),
  chainId: t.integer().notNull().default(1),
}));

// PoolInteraction entity - immutable interaction records
export const poolInteraction = onchainTable("pool_interaction", (t) => ({
  id: t.hex().primaryKey(), // txHash + counter
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.integer().notNull(), 
  transactionHash: t.hex().notNull(),
  userId: t.hex().notNull().references(() => user.id),
  type: t.bigint().notNull(), // 0=STAKE, 1=WITHDRAW, 2=CLAIM
  amount: t.bigint().notNull(),
  depositPool: t.hex().notNull(),
  totalStaked: t.bigint().notNull(),
  rate: t.bigint().notNull(),
  chainId: t.integer().notNull().default(1),
}));

// Referral system entities
export const referrer = onchainTable("referrer", (t) => ({
  id: t.hex().primaryKey(), // same as user.id
  userId: t.hex().notNull().references(() => user.id),
  referrerAddress: t.hex().notNull(),
  claimed: t.bigint().notNull().default(0n),
  chainId: t.integer().notNull().default(1),
}));

export const referral = onchainTable("referral", (t) => ({
  id: t.hex().primaryKey(), // referralUser.id + referrer.id
  referralUserId: t.hex().notNull().references(() => user.id),
  referrerId: t.hex().notNull().references(() => referrer.id),
  referralAddress: t.hex().notNull(),
  referrerAddress: t.hex().notNull(),
  amount: t.bigint().notNull(),
  chainId: t.integer().notNull().default(1),
}));

// Helper entity for interaction counting
export const interactionCount = onchainTable("interaction_count", (t) => ({
  id: t.hex().primaryKey(), // transaction hash
  count: t.bigint().notNull().default(0n),
}));

// Proxy contract events (immutable)
export const adminChanged = onchainTable("admin_changed", (t) => ({
  id: t.hex().primaryKey(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.integer().notNull(),
  transactionHash: t.hex().notNull(),
  previousAdmin: t.hex().notNull(),
  newAdmin: t.hex().notNull(),
  depositPool: t.hex().notNull(),
}));

export const beaconUpgraded = onchainTable("beacon_upgraded", (t) => ({
  id: t.hex().primaryKey(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.integer().notNull(), 
  transactionHash: t.hex().notNull(),
  beacon: t.hex().notNull(),
  depositPool: t.hex().notNull(),
}));

// Add other proxy events similarly...

// Define relationships between tables  
export const userRelations = relations(user, ({ many, one }) => ({
  interactions: many(poolInteraction),
  referrerProfile: one(referrer, {
    fields: [user.id],
    references: [referrer.userId],
  }),
}));

export const poolInteractionRelations = relations(poolInteraction, ({ one }) => ({
  user: one(user, {
    fields: [poolInteraction.userId],
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
    fields: [referral.referralUserId],
    references: [user.id],
  }),
  referrer: one(referrer, {
    fields: [referral.referrerId], 
    references: [referrer.id],
  }),
}));
```

#### **3.2 Schema compatibility validation**
- Ensure all existing GraphQL queries can be supported
- Maintain exact field names and types from original schema
- Test relationship queries match subgraph behavior

### **Phase 4: Indexing Logic Implementation (Day 4-5)**

#### **4.1 Core event handlers matching subgraph logic**

```typescript
import { ponder } from "ponder:registry";
import { 
  depositPool, 
  user, 
  poolInteraction, 
  referrer, 
  referral,
  interactionCount 
} from "ponder:schema";

// Helper functions (matching subgraph logic)
function getUserId(address: string, rewardPoolId: bigint, depositPoolAddr: string): string {
  return `${address}${depositPoolAddr}${rewardPoolId.toString()}`;
}

function getDepositPoolId(rewardPoolId: bigint, depositPoolAddr: string): string {
  return `${rewardPoolId.toString()}${depositPoolAddr}`;
}

async function getOrCreateInteractionCount(context: any, txHash: string) {
  let count = await context.db
    .select()
    .from(interactionCount)
    .where(eq(interactionCount.id, txHash))
    .limit(1);
    
  if (count.length === 0) {
    await context.db.insert(interactionCount).values({
      id: txHash,
      count: 0n,
    });
    return 0n;
  }
  
  const newCount = count[0].count + 1n;
  await context.db
    .update(interactionCount)
    .set({ count: newCount })
    .where(eq(interactionCount.id, txHash));
    
  return newCount;
}

// UserStaked event handler
ponder.on("DepositPoolStETH:UserStaked", async ({ event, context }) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddr = event.log.address;
  
  // Get or create deposit pool
  const poolId = getDepositPoolId(rewardPoolIndex, depositPoolAddr);
  await context.db
    .insert(depositPool)
    .values({
      id: poolId,
      rewardPoolId: rewardPoolIndex,
      depositPool: depositPoolAddr,
      totalStaked: amount,
      chainId: 1,
    })
    .onConflictDoUpdate((row) => ({
      totalStaked: row.totalStaked + amount,
    }));

  // Get or create user 
  const userId = getUserId(userAddress, rewardPoolIndex, depositPoolAddr);
  await context.db
    .insert(user)
    .values({
      id: userId,
      address: userAddress,
      rewardPoolId: rewardPoolIndex,
      depositPool: depositPoolAddr,
      staked: amount,
      claimed: 0n,
      chainId: 1,
    })
    .onConflictDoUpdate((row) => ({
      staked: row.staked + amount,
    }));

  // Create pool interaction record
  const counter = await getOrCreateInteractionCount(context, event.transaction.hash);
  const interactionId = `${event.transaction.hash}${counter.toString()}`;
  
  // Get user data for rate calculation (would need to call contract)
  const rate = 1000000n; // Placeholder - implement actual rate fetching
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: Number(event.block.timestamp),
    transactionHash: event.transaction.hash,
    userId: userId,
    type: 0n, // STAKE
    amount: amount,
    depositPool: depositPoolAddr,
    totalStaked: amount, // Would need to get current total
    rate: rate,
    chainId: 1,
  });
});

// UserWithdrawn event handler
ponder.on("DepositPoolStETH:UserWithdrawn", async ({ event, context }) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddr = event.log.address;
  
  // Update deposit pool total
  const poolId = getDepositPoolId(rewardPoolIndex, depositPoolAddr);
  await context.db
    .update(depositPool)
    .set({ totalStaked: sql`${depositPool.totalStaked} - ${amount}` })
    .where(eq(depositPool.id, poolId));

  // Update user staked amount
  const userId = getUserId(userAddress, rewardPoolIndex, depositPoolAddr);
  await context.db
    .update(user)
    .set({ staked: sql`${user.staked} - ${amount}` })
    .where(eq(user.id, userId));

  // Create interaction record
  const counter = await getOrCreateInteractionCount(context, event.transaction.hash);
  const interactionId = `${event.transaction.hash}${counter.toString()}`;
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: Number(event.block.timestamp),
    transactionHash: event.transaction.hash,
    userId: userId,
    type: 1n, // WITHDRAW
    amount: amount,
    depositPool: depositPoolAddr,
    totalStaked: 0n, // Would get from contract call
    rate: 1000000n, // Would get from contract call
    chainId: 1,
  });
});

// UserClaimed event handler  
ponder.on("DepositPoolStETH:UserClaimed", async ({ event, context }) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddr = event.log.address;
  
  // Update user claimed amount
  const userId = getUserId(userAddress, rewardPoolIndex, depositPoolAddr);
  await context.db
    .update(user)
    .set({ claimed: sql`${user.claimed} + ${amount}` })
    .where(eq(user.id, userId));

  // Create interaction record
  const counter = await getOrCreateInteractionCount(context, event.transaction.hash);
  const interactionId = `${event.transaction.hash}${counter.toString()}`;
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: Number(event.block.timestamp),
    transactionHash: event.transaction.hash,
    userId: userId,
    type: 2n, // CLAIM
    amount: amount,
    depositPool: depositPoolAddr,
    totalStaked: 0n, // Would get from contract
    rate: 1000000n, // Would get from contract
    chainId: 1,
  });
});

// Handle all other deposit pools with similar logic
ponder.on("DepositPoolWBTC:UserStaked", async ({ event, context }) => {
  // Same logic as stETH but for wBTC pool
});

// Referral event handlers
ponder.on("DepositPoolStETH:UserReferred", async ({ event, context }) => {
  const { rewardPoolIndex, referral: referralAddr, referrer: referrerAddr, amount } = event.args;
  const depositPoolAddr = event.log.address;
  
  const referralUserId = getUserId(referralAddr, rewardPoolIndex, depositPoolAddr);
  const referrerUserId = getUserId(referrerAddr, rewardPoolIndex, depositPoolAddr);
  
  // Create or update referrer
  await context.db
    .insert(referrer)
    .values({
      id: referrerUserId,
      userId: referrerUserId,
      referrerAddress: referrerAddr,
      claimed: 0n,
      chainId: 1,
    })
    .onConflictDoNothing();
  
  // Create referral record
  const referralId = `${referralUserId}${referrerUserId}`;
  await context.db.insert(referral).values({
    id: referralId,
    referralUserId: referralUserId,
    referrerId: referrerUserId,
    referralAddress: referralAddr,
    referrerAddress: referrerAddr,
    amount: amount,
    chainId: 1,
  });
});
```

#### **4.2 Contract data fetching**
- Implement contract calls to get user data, rates, and totals
- Use Ponder's `readContract` functionality for on-chain data
- Cache frequently accessed data to optimize performance

#### **4.3 Multi-pool support**  
- Create event handlers for each deposit pool (stETH, wBTC, wETH, USDC, USDT)
- Ensure consistent ID generation across all pools
- Handle pool-specific logic and token decimals

### **Phase 5: Migration Support (Day 6)**

#### **5.1 Update migration scripts**
Extend `scripts/migrate-subgraph.js` for capital entities:

```javascript
// Add to ENTITY_MAPPING
const ENTITY_MAPPING = {
  // Existing mappings...
  'DepositPool': 'depositPool',
  'User': 'user', 
  'PoolInteraction': 'poolInteraction',
  'Referral': 'referral',
  'Referrer': 'referrer',
  'InteractionCount': 'interactionCount',
  'AdminChanged': 'adminChanged',
  'BeaconUpgraded': 'beaconUpgraded',
  // ... other proxy events
};

// Add capital-specific field mappings
const FIELD_MAPPING = {
  'DepositPool': {
    'id': 'id',
    'rewardPoolId': 'rewardPoolId', 
    'depositPool': 'depositPool',
    'totalStaked': 'totalStaked'
  },
  'User': {
    'id': 'id',
    'address': 'address',
    'rewardPoolId': 'rewardPoolId',
    'depositPool': 'depositPool', 
    'staked': 'staked',
    'claimed': 'claimed',
    'interactions': 'interactions' // Relationship
  }
  // ... add other entities
};
```

#### **5.2 GraphQL compatibility layer**
- Ensure Ponder GraphQL API matches subgraph field names exactly
- Test all existing queries work without modification
- Document any breaking changes (should be none)

### **Phase 6: Testing & Integration (Day 7)**

#### **6.1 Local testing**
- Test indexing with historical blocks from subgraph start blocks
- Compare results with existing subgraph data
- Verify all event handlers work correctly
- Test relationship queries match subgraph results

#### **6.2 Federation integration** 
```yaml
# Update gateway/apollo-federation/supergraph.yaml
federatedGraphs:
  - name: ponder-capital
    routing_url: http://ponder-capital:42069/graphql
    schema:
      subgraph_path: ./ponder-capital-schema.graphql
```

#### **6.3 Docker setup**
```yaml
# Add to docker-compose.yml
services:
  ponder-capital:
    build:
      context: ./apps/ponder-capital
    environment:
      - PONDER_RPC_URL_1=${ETHEREUM_RPC_URL}
      - PONDER_RPC_URL_42161=${ARBITRUM_RPC_URL}
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/ponder_capital
    ports:
      - "42070:42069"
    depends_on:
      - postgres
```

### **Phase 7: Documentation & Deployment (Day 8)**

#### **7.1 Update project documentation**
- Update main README with capital indexer information
- Document new endpoints and GraphQL schema
- Create migration guide from subgraph to Ponder

#### **7.2 Production deployment**
- Configure environment variables for production
- Set up monitoring and alerting
- Deploy and verify data consistency with existing subgraph
- Gradual rollout with parallel running

---

## Priority Todo Checklist

### **Critical Path (Week 1)**
- [ ] **Extract DepositPool ABI** from Subgraph/abis/DepositPool.json
- [ ] **Find deployment blocks** for distributor contracts (check Etherscan creation txs)
- [ ] **Create basic ponder.config.ts** with all 5 deposit pool contracts  
- [ ] **Implement core schema** exactly matching subgraph entities
- [ ] **Create UserStaked event handler** for stETH pool
- [ ] **Test with historical data** from block 19,178,638
- [ ] **Implement remaining event handlers** (UserWithdrawn, UserClaimed, etc.)
- [ ] **Add referral system handlers** 
- [ ] **Create migration utility** for existing queries
- [ ] **Set up local federation** testing

### **High Priority (Week 2)**  
- [ ] Add all 5 deposit pool contract handlers (wBTC, wETH, USDC, USDT)
- [ ] Implement contract data fetching for rates and totals
- [ ] Add cross-chain message handling (L1↔L2)
- [ ] Performance optimization for high-volume pools
- [ ] Comprehensive error handling and monitoring
- [ ] Production deployment and data validation

### **Key Implementation Notes**

1. **Exact Schema Compatibility**: Must maintain exact field names and types from existing subgraph
2. **Multi-Pool Architecture**: Handle 5 separate deposit pool contracts with shared logic
3. **ID Generation**: Follow existing subgraph ID patterns exactly for data consistency
4. **Rate Calculation**: Implement contract calls to get accurate staking rates and totals
5. **Referral System**: Complex referral logic with bidirectional relationships
6. **Performance**: stETH pool has highest transaction volume since block 19M
7. **Data Validation**: Must match existing subgraph results before production switch

**Next Immediate Action**: Extract DepositPool ABI and create basic ponder.config.ts with all 5 contract addresses and correct start blocks.
