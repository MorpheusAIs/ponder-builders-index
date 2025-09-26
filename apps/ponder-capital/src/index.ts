import { ponder } from "ponder:registry";
import { 
  depositPool,
  user,
  poolInteraction,
  interactionCount,
  referrer,
  referral,
  adminChanged,
  beaconUpgraded,
  initialized,
  upgraded,
  ownershipTransferred
} from "ponder:schema";
import { eq, sql } from "ponder";
import { DepositPoolAbi } from "../../../packages/shared-abis/src/index.js";

// Helper functions matching existing subgraph logic

// Create User ID: address + depositPool + rewardPoolId
const createUserId = (address: `0x${string}`, depositPool: `0x${string}`, rewardPoolId: bigint): `0x${string}` => {
  // Convert bigint to hex bytes and concatenate: address + depositPool + rewardPoolId
  const rewardPoolBytes = `0x${rewardPoolId.toString(16).padStart(64, '0')}` as const;
  return `${address}${depositPool.slice(2)}${rewardPoolBytes.slice(2)}` as const;
};

// Create DepositPool ID: rewardPoolId + depositPool  
const createDepositPoolId = (rewardPoolId: bigint, depositPool: `0x${string}`): `0x${string}` => {
  // Convert bigint to hex bytes and concatenate: rewardPoolId + depositPool
  const rewardPoolBytes = `0x${rewardPoolId.toString(16).padStart(64, '0')}` as const;
  return `${rewardPoolBytes}${depositPool.slice(2)}` as const;
};

// Create PoolInteraction ID: txHash + counter
const createPoolInteractionId = (txHash: `0x${string}`, counter: number): `0x${string}` => {
  // Convert counter to hex and concatenate: txHash + counter (as 4-byte hex)
  const counterHex = counter.toString(16).padStart(8, '0');
  return `${txHash}${counterHex}` as const;
};

// Create event ID: txHash + logIndex
const createEventId = (txHash: `0x${string}`, logIndex: number): `0x${string}` => {
  // Convert logIndex to hex and concatenate: txHash + logIndex (as 4-byte hex)
  const logIndexHex = logIndex.toString(16).padStart(8, '0');
  return `${txHash}${logIndexHex}` as const;
};

// Get or create interaction counter
const getOrIncrementInteractionCount = async (txHash: `0x${string}`, context: any): Promise<number> => {
  let counter = await context.db.find(interactionCount, { id: txHash });

  if (!counter) {
    await context.db.insert(interactionCount).values({
      id: txHash,
      count: 1n,
    });
    return 0; // First interaction is index 0
  } else {
    const newCount = counter.count + 1n;
    await context.db
      .update(interactionCount, { id: txHash })
      .set({ count: newCount });
    return Number(newCount - 1n); // Return previous count as index
  }
};

// Get or create deposit pool
const getOrCreateDepositPool = async (rewardPoolId: bigint, depositPoolAddress: `0x${string}`, context: any) => {
  const poolId = createDepositPoolId(rewardPoolId, depositPoolAddress);
  
  let pool = await context.db.find(depositPool, { id: poolId });

  if (!pool) {
    await context.db.insert(depositPool).values({
      id: poolId,
      rewardPoolId,
      depositPool: depositPoolAddress,
      totalStaked: 0n,
    });
    
    pool = await context.db.find(depositPool, { id: poolId });
  }
  
  return pool;
};

// Get or create user
const getOrCreateUser = async (address: `0x${string}`, rewardPoolId: bigint, depositPoolAddress: `0x${string}`, context: any) => {
  const userId = createUserId(address, depositPoolAddress, rewardPoolId);
  
  let userRecord = await context.db.find(user, { id: userId });

  if (!userRecord) {
    await context.db.insert(user).values({
      id: userId,
      address,
      rewardPoolId,
      depositPool: depositPoolAddress,
      staked: 0n,
      claimed: 0n,
    });
    
    userRecord = await context.db.find(user, { id: userId });
  }
  
  return userRecord;
};

// Contract Data Fetching - Phase 4.2 Implementation
// Cache for frequently accessed contract data
const contractDataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

// Get current rate for a user from the deposit pool contract
const getUserRate = async (depositPoolAddress: `0x${string}`, userAddress: `0x${string}`, rewardPoolIndex: bigint, context: any): Promise<bigint> => {
  const cacheKey = `rate-${depositPoolAddress}-${userAddress}-${rewardPoolIndex}`;
  const cached = contractDataCache.get(cacheKey);
  
  // Return cached value if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as bigint;
  }

  try {
    // Read the user's current rate from the contract
    const userData = await context.client.readContract({
      address: depositPoolAddress,
      abi: DepositPoolAbi,
      functionName: "usersData",
      args: [userAddress, rewardPoolIndex],
    });

    // userData typically returns [staked, withdrawn, rate, claimed, referrer]
    const rate = userData[2] as bigint; // Rate is typically the 3rd element
    
    // Cache the result
    contractDataCache.set(cacheKey, { data: rate, timestamp: Date.now() });
    
    return rate;
  } catch (error) {
    console.warn(`Failed to fetch rate for user ${userAddress} in pool ${depositPoolAddress}:`, error);
    return 0n; // Return 0 as fallback
  }
};

// Removed: getContractTotalStaked (using original event-based totalStaked calculations instead)

// Get user's complete data from the contract
const getUserContractData = async (depositPoolAddress: `0x${string}`, userAddress: `0x${string}`, rewardPoolIndex: bigint, context: any) => {
  const cacheKey = `userData-${depositPoolAddress}-${userAddress}-${rewardPoolIndex}`;
  const cached = contractDataCache.get(cacheKey);
  
  // Return cached value if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Read the user's complete data from the contract
    const userData = await context.client.readContract({
      address: depositPoolAddress,
      abi: DepositPoolAbi,
      functionName: "usersData",
      args: [userAddress, rewardPoolIndex],
    });

    // Parse the returned data structure
    const parsedData = {
      staked: userData[0] as bigint,
      withdrawn: userData[1] as bigint,
      rate: userData[2] as bigint,
      claimed: userData[3] as bigint,
      referrer: userData[4] as `0x${string}`,
    };
    
    // Cache the result
    contractDataCache.set(cacheKey, { data: parsedData, timestamp: Date.now() });
    
    return parsedData;
  } catch (error) {
    console.warn(`Failed to fetch user data for ${userAddress} in pool ${depositPoolAddress}:`, error);
    return {
      staked: 0n,
      withdrawn: 0n,
      rate: 0n,
      claimed: 0n,
      referrer: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    };
  }
};

// Clear expired cache entries periodically
const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of contractDataCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      contractDataCache.delete(key);
    }
  }
};

// Set up cache cleanup interval
setInterval(clearExpiredCache, CACHE_TTL);

// Removed: createPoolInteractionWithContractData helper (reverted to original subgraph logic)

// Deposit Pool Event Handlers - matching exact subgraph logic

// Proxy events (immutable)
ponder.on("DepositPoolStETH:AdminChanged", async ({ event, context }: any) => {
  await context.db.insert(adminChanged).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousAdmin: event.args.previousAdmin,
    newAdmin: event.args.newAdmin,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolStETH:BeaconUpgraded", async ({ event, context }: any) => {
  await context.db.insert(beaconUpgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    beacon: event.args.beacon,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolStETH:Initialized", async ({ event, context }: any) => {
  await context.db.insert(initialized).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    version: event.args.version,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolStETH:Upgraded", async ({ event, context }: any) => {
  await context.db.insert(upgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    implementation: event.args.implementation,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolStETH:OwnershipTransferred", async ({ event, context }: any) => {
  await context.db.insert(ownershipTransferred).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousOwner: event.args.previousOwner,
    newOwner: event.args.newOwner,
    depositPool: event.log.address,
  });
});

// Main deposit pool events
ponder.on("DepositPoolStETH:UserStaked", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get or create deposit pool - using Ponder find API
  const poolId = createDepositPoolId(rewardPoolIndex, depositPoolAddress);
  let pool = await context.db.find(depositPool, { id: poolId });

  if (!pool) {
    await context.db.insert(depositPool).values({
      id: poolId,
      rewardPoolId: rewardPoolIndex,
      depositPool: depositPoolAddress,
      totalStaked: 0n,
    });
    
    pool = await context.db.find(depositPool, { id: poolId });
  }
  
  // Get or create user - using Ponder find API  
  const userId = createUserId(userAddress, depositPoolAddress, rewardPoolIndex);
  let userRecord = await context.db.find(user, { id: userId });

  if (!userRecord) {
    await context.db.insert(user).values({
      id: userId,
      address: userAddress,
      rewardPoolId: rewardPoolIndex,
      depositPool: depositPoolAddress,
      staked: 0n,
      claimed: 0n,
    });
    
    userRecord = await context.db.find(user, { id: userId });
  }
  
  // Update user staked amount
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked + amount,
    });

  // Update pool total staked
  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 0n, // STAKE = 0
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolStETH:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get or create deposit pool
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  
  // Get or create user
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  // Update user staked amount
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked - amount,
    });

  // Update pool total staked
  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked - amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 1n, // WITHDRAW = 1
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolStETH:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get or create deposit pool
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  
  // Get or create user
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  // Update user claimed amount
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      claimed: userRecord.claimed + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 2n, // CLAIM = 2
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked, // No change to total staked on claim (original logic)
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolStETH:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get or create users
  const referralUserRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  // Get or create referrer
  let referrerResults = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);
    
  let referrerRecord = referrerResults[0] || null;

  if (!referrerRecord) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id, // Same as user.id
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    const newReferrerResults = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
    referrerRecord = newReferrerResults[0];
  }
  
  // Create referral record
  const referralId = createUserId(userAddress, referrerAddress, rewardPoolIndex); // user.id + referrer.id equivalent
  await context.db.insert(referral).values({
    id: referralId,
    referral: referralUserRecord.id, // FIXED: "referral" field name for GraphQL compatibility
    referrer: referrerRecord.id, // FIXED: "referrer" field name for GraphQL compatibility
    referralAddress: userAddress,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolStETH:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get referrer user
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  // Update referrer claimed amount
  await context.db
    .update(referrer, { userId: referrerUserRecord.id })
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    });
});

// =============================================================================
// WBTC DEPOSIT POOL EVENT HANDLERS  
// =============================================================================

ponder.on("DepositPoolWBTC:AdminChanged", async ({ event, context }: any) => {
  await context.db.insert(adminChanged).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousAdmin: event.args.previousAdmin,
    newAdmin: event.args.newAdmin,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWBTC:BeaconUpgraded", async ({ event, context }: any) => {
  await context.db.insert(beaconUpgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    beacon: event.args.beacon,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWBTC:Initialized", async ({ event, context }: any) => {
  await context.db.insert(initialized).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    version: event.args.version,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWBTC:Upgraded", async ({ event, context }: any) => {
  await context.db.insert(upgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    implementation: event.args.implementation,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWBTC:OwnershipTransferred", async ({ event, context }: any) => {
  await context.db.insert(ownershipTransferred).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousOwner: event.args.previousOwner,
    newOwner: event.args.newOwner,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWBTC:UserStaked", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked + amount,
    });

  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 0n, // STAKE = 0
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolWBTC:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked - amount,
    });

  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked - amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 1n, // WITHDRAW = 1
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolWBTC:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      claimed: userRecord.claimed + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 2n, // CLAIM = 2
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked, // No change to total staked on claim (original logic)
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolWBTC:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referralUserRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  let referrerResults = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);
    
  let referrerRecord = referrerResults[0] || null;

  if (!referrerRecord) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id,
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    const newReferrerResults = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
    referrerRecord = newReferrerResults[0];
  }
  
  const referralId = createUserId(userAddress, referrerAddress, rewardPoolIndex);
  await context.db.insert(referral).values({
    id: referralId,
    referral: referralUserRecord.id, // FIXED: "referral" field name for GraphQL compatibility
    referrer: referrerRecord.id, // FIXED: "referrer" field name for GraphQL compatibility
    referralAddress: userAddress,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolWBTC:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(referrer, { userId: referrerUserRecord.id })
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    });
});

// =============================================================================
// WETH DEPOSIT POOL EVENT HANDLERS
// =============================================================================

ponder.on("DepositPoolWETH:AdminChanged", async ({ event, context }: any) => {
  await context.db.insert(adminChanged).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousAdmin: event.args.previousAdmin,
    newAdmin: event.args.newAdmin,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWETH:BeaconUpgraded", async ({ event, context }: any) => {
  await context.db.insert(beaconUpgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    beacon: event.args.beacon,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWETH:Initialized", async ({ event, context }: any) => {
  await context.db.insert(initialized).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    version: event.args.version,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWETH:Upgraded", async ({ event, context }: any) => {
  await context.db.insert(upgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    implementation: event.args.implementation,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWETH:OwnershipTransferred", async ({ event, context }: any) => {
  await context.db.insert(ownershipTransferred).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousOwner: event.args.previousOwner,
    newOwner: event.args.newOwner,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolWETH:UserStaked", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked + amount,
    });

  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 0n, // STAKE = 0
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolWETH:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked - amount,
    });

  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked - amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 1n, // WITHDRAW = 1
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolWETH:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      claimed: userRecord.claimed + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 2n, // CLAIM = 2
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked, // No change to total staked on claim (original logic)
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolWETH:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referralUserRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  let referrerResults = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);
    
  let referrerRecord = referrerResults[0] || null;

  if (!referrerRecord) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id,
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    const newReferrerResults = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
    referrerRecord = newReferrerResults[0];
  }
  
  const referralId = createUserId(userAddress, referrerAddress, rewardPoolIndex);
  await context.db.insert(referral).values({
    id: referralId,
    referral: referralUserRecord.id, // FIXED: "referral" field name for GraphQL compatibility
    referrer: referrerRecord.id, // FIXED: "referrer" field name for GraphQL compatibility
    referralAddress: userAddress,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolWETH:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(referrer, { userId: referrerUserRecord.id })
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    });
});

// TODO: Add event handlers for USDC, USDT pools following the same pattern// =============================================================================
// USDC DEPOSIT POOL EVENT HANDLERS
// =============================================================================

ponder.on("DepositPoolUSDC:AdminChanged", async ({ event, context }: any) => {
  await context.db.insert(adminChanged).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousAdmin: event.args.previousAdmin,
    newAdmin: event.args.newAdmin,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDC:BeaconUpgraded", async ({ event, context }: any) => {
  await context.db.insert(beaconUpgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    beacon: event.args.beacon,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDC:Initialized", async ({ event, context }: any) => {
  await context.db.insert(initialized).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    version: event.args.version,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDC:Upgraded", async ({ event, context }: any) => {
  await context.db.insert(upgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    implementation: event.args.implementation,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDC:OwnershipTransferred", async ({ event, context }: any) => {
  await context.db.insert(ownershipTransferred).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousOwner: event.args.previousOwner,
    newOwner: event.args.newOwner,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDC:UserStaked", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked + amount,
    });

  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 0n, // STAKE = 0
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolUSDC:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked - amount,
    });

  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked - amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 1n, // WITHDRAW = 1
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolUSDC:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      claimed: userRecord.claimed + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 2n, // CLAIM = 2
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked, // No change to total staked on claim (original logic)
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolUSDC:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referralUserRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  let referrerResults = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);
    
  let referrerRecord = referrerResults[0] || null;

  if (!referrerRecord) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id,
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    const newReferrerResults = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
    referrerRecord = newReferrerResults[0];
  }
  
  const referralId = createUserId(userAddress, referrerAddress, rewardPoolIndex);
  await context.db.insert(referral).values({
    id: referralId,
    referral: referralUserRecord.id, // FIXED: "referral" field name for GraphQL compatibility
    referrer: referrerRecord.id, // FIXED: "referrer" field name for GraphQL compatibility
    referralAddress: userAddress,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolUSDC:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(referrer, { userId: referrerUserRecord.id })
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    });
});

// =============================================================================
// USDT DEPOSIT POOL EVENT HANDLERS
// =============================================================================

ponder.on("DepositPoolUSDT:AdminChanged", async ({ event, context }: any) => {
  await context.db.insert(adminChanged).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousAdmin: event.args.previousAdmin,
    newAdmin: event.args.newAdmin,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDT:BeaconUpgraded", async ({ event, context }: any) => {
  await context.db.insert(beaconUpgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    beacon: event.args.beacon,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDT:Initialized", async ({ event, context }: any) => {
  await context.db.insert(initialized).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    version: event.args.version,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDT:Upgraded", async ({ event, context }: any) => {
  await context.db.insert(upgraded).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    implementation: event.args.implementation,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDT:OwnershipTransferred", async ({ event, context }: any) => {
  await context.db.insert(ownershipTransferred).values({
    id: createEventId(event.transaction.hash, event.log.logIndex),
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    previousOwner: event.args.previousOwner,
    newOwner: event.args.newOwner,
    depositPool: event.log.address,
  });
});

ponder.on("DepositPoolUSDT:UserStaked", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked + amount,
    });

  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 0n, // STAKE = 0
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolUSDT:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      staked: userRecord.staked - amount,
    });

  await context.db
    .update(depositPool, { id: pool.id })
    .set({
      totalStaked: pool.totalStaked - amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 1n, // WITHDRAW = 1
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount, // Keep original event-based calculation
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolUSDT:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user, { id: userRecord.id })
    .set({
      claimed: userRecord.claimed + amount,
    });

  // Get user's rate from contract (Phase 4.2 improvement)
  const userRate = await getUserRate(depositPoolAddress, userAddress, rewardPoolIndex, context);

  // Get interaction counter and create pool interaction (original subgraph logic)
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    user: userRecord.id, // FIXED: "user" field name for GraphQL compatibility
    type: 2n, // CLAIM = 2
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked, // No change to total staked on claim (original logic)
    rate: userRate, // Phase 4.2: Real rate instead of 0n
  });
});

ponder.on("DepositPoolUSDT:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user: userAddress, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referralUserRecord = await getOrCreateUser(userAddress, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  let referrerResults = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);
    
  let referrerRecord = referrerResults[0] || null;

  if (!referrerRecord) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id,
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    const newReferrerResults = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
    referrerRecord = newReferrerResults[0];
  }
  
  const referralId = createUserId(userAddress, referrerAddress, rewardPoolIndex);
  await context.db.insert(referral).values({
    id: referralId,
    referral: referralUserRecord.id, // FIXED: "referral" field name for GraphQL compatibility
    referrer: referrerRecord.id, // FIXED: "referrer" field name for GraphQL compatibility
    referralAddress: userAddress,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolUSDT:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(referrer, { userId: referrerUserRecord.id })
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    });
});
