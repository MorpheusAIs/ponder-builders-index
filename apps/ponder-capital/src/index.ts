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
  let counter = await context.db
    .select()
    .from(interactionCount)
    .where(eq(interactionCount.id, txHash))
    .limit(1);

  if (counter.length === 0) {
    await context.db.insert(interactionCount).values({
      id: txHash,
      count: 1n,
    });
    return 0; // First interaction is index 0
  } else {
    const newCount = counter[0].count + 1n;
    await context.db
      .update(interactionCount)
      .set({ count: newCount })
      .where(eq(interactionCount.id, txHash));
    return Number(newCount - 1n); // Return previous count as index
  }
};

// Get or create deposit pool
const getOrCreateDepositPool = async (rewardPoolId: bigint, depositPoolAddress: `0x${string}`, context: any) => {
  const poolId = createDepositPoolId(rewardPoolId, depositPoolAddress);
  
  let pool = await context.db
    .select()
    .from(depositPool)
    .where(eq(depositPool.id, poolId))
    .limit(1);

  if (pool.length === 0) {
    await context.db.insert(depositPool).values({
      id: poolId,
      rewardPoolId,
      depositPool: depositPoolAddress,
      totalStaked: 0n,
    });
    
    pool = await context.db
      .select()
      .from(depositPool)
      .where(eq(depositPool.id, poolId))
      .limit(1);
  }
  
  return pool[0];
};

// Get or create user
const getOrCreateUser = async (address: `0x${string}`, rewardPoolId: bigint, depositPoolAddress: `0x${string}`, context: any) => {
  const userId = createUserId(address, depositPoolAddress, rewardPoolId);
  
  let userRecord = await context.db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (userRecord.length === 0) {
    await context.db.insert(user).values({
      id: userId,
      address,
      rewardPoolId,
      depositPool: depositPoolAddress,
      staked: 0n,
      claimed: 0n,
    });
    
    userRecord = await context.db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
  }
  
  return userRecord[0];
};

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
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get or create deposit pool
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  
  // Get or create user
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  // Update user staked amount
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked + amount,
    })
    .where(eq(user.id, userRecord.id));

  // Update pool total staked
  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked + amount,
    })
    .where(eq(depositPool.id, pool.id));

  // Get interaction counter and create pool interaction
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 0n, // STAKE = 0
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount,
    rate: 0n, // TODO: Calculate rate based on contract logic
  });
});

ponder.on("DepositPoolStETH:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get or create deposit pool
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  
  // Get or create user
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  // Update user staked amount
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked - amount,
    })
    .where(eq(user.id, userRecord.id));

  // Update pool total staked
  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked - amount,
    })
    .where(eq(depositPool.id, pool.id));

  // Get interaction counter and create pool interaction
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 1n, // WITHDRAW = 1
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount,
    rate: 0n, // TODO: Calculate rate based on contract logic
  });
});

ponder.on("DepositPoolStETH:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get or create deposit pool
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  
  // Get or create user
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  // Update user claimed amount
  await context.db
    .update(user)
    .set({
      claimed: userRecord.claimed + amount,
    })
    .where(eq(user.id, userRecord.id));

  // Get interaction counter and create pool interaction
  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 2n, // CLAIM = 2
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked, // No change to total staked on claim
    rate: 0n, // TODO: Calculate rate based on contract logic
  });
});

ponder.on("DepositPoolStETH:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  // Get or create users
  const referralUserRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  // Get or create referrer
  let referrerRecord = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);

  if (referrerRecord.length === 0) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id, // Same as user.id
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    referrerRecord = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
  }
  
  // Create referral record
  const referralId = createUserId(user, referrerAddress, rewardPoolIndex); // user.id + referrer.id equivalent
  await context.db.insert(referral).values({
    id: referralId,
    referralUserId: referralUserRecord.id,
    referrerId: referrerRecord[0].id,
    referralAddress: user,
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
    .update(referrer)
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    })
    .where(eq(referrer.userId, referrerUserRecord.id));
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
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked + amount,
    })
    .where(eq(user.id, userRecord.id));

  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked + amount,
    })
    .where(eq(depositPool.id, pool.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 0n, // STAKE = 0
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount,
    rate: 0n,
  });
});

ponder.on("DepositPoolWBTC:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked - amount,
    })
    .where(eq(user.id, userRecord.id));

  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked - amount,
    })
    .where(eq(depositPool.id, pool.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 1n, // WITHDRAW = 1
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount,
    rate: 0n,
  });
});

ponder.on("DepositPoolWBTC:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      claimed: userRecord.claimed + amount,
    })
    .where(eq(user.id, userRecord.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 2n, // CLAIM = 2
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked,
    rate: 0n,
  });
});

ponder.on("DepositPoolWBTC:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referralUserRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  let referrerRecord = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);

  if (referrerRecord.length === 0) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id,
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    referrerRecord = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
  }
  
  const referralId = createUserId(user, referrerAddress, rewardPoolIndex);
  await context.db.insert(referral).values({
    id: referralId,
    referralUserId: referralUserRecord.id,
    referrerId: referrerRecord[0].id,
    referralAddress: user,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolWBTC:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(referrer)
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    })
    .where(eq(referrer.userId, referrerUserRecord.id));
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
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked + amount,
    })
    .where(eq(user.id, userRecord.id));

  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked + amount,
    })
    .where(eq(depositPool.id, pool.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 0n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount,
    rate: 0n,
  });
});

ponder.on("DepositPoolWETH:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked - amount,
    })
    .where(eq(user.id, userRecord.id));

  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked - amount,
    })
    .where(eq(depositPool.id, pool.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 1n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount,
    rate: 0n,
  });
});

ponder.on("DepositPoolWETH:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      claimed: userRecord.claimed + amount,
    })
    .where(eq(user.id, userRecord.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 2n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked,
    rate: 0n,
  });
});

ponder.on("DepositPoolWETH:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referralUserRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  let referrerRecord = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);

  if (referrerRecord.length === 0) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id,
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    referrerRecord = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
  }
  
  const referralId = createUserId(user, referrerAddress, rewardPoolIndex);
  await context.db.insert(referral).values({
    id: referralId,
    referralUserId: referralUserRecord.id,
    referrerId: referrerRecord[0].id,
    referralAddress: user,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolWETH:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(referrer)
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    })
    .where(eq(referrer.userId, referrerUserRecord.id));
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
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked + amount,
    })
    .where(eq(user.id, userRecord.id));

  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked + amount,
    })
    .where(eq(depositPool.id, pool.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 0n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount,
    rate: 0n,
  });
});

ponder.on("DepositPoolUSDC:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked - amount,
    })
    .where(eq(user.id, userRecord.id));

  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked - amount,
    })
    .where(eq(depositPool.id, pool.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 1n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount,
    rate: 0n,
  });
});

ponder.on("DepositPoolUSDC:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      claimed: userRecord.claimed + amount,
    })
    .where(eq(user.id, userRecord.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 2n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked,
    rate: 0n,
  });
});

ponder.on("DepositPoolUSDC:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referralUserRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  let referrerRecord = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);

  if (referrerRecord.length === 0) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id,
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    referrerRecord = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
  }
  
  const referralId = createUserId(user, referrerAddress, rewardPoolIndex);
  await context.db.insert(referral).values({
    id: referralId,
    referralUserId: referralUserRecord.id,
    referrerId: referrerRecord[0].id,
    referralAddress: user,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolUSDC:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(referrer)
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    })
    .where(eq(referrer.userId, referrerUserRecord.id));
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
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked + amount,
    })
    .where(eq(user.id, userRecord.id));

  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked + amount,
    })
    .where(eq(depositPool.id, pool.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 0n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked + amount,
    rate: 0n,
  });
});

ponder.on("DepositPoolUSDT:UserWithdrawn", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      staked: userRecord.staked - amount,
    })
    .where(eq(user.id, userRecord.id));

  await context.db
    .update(depositPool)
    .set({
      totalStaked: pool.totalStaked - amount,
    })
    .where(eq(depositPool.id, pool.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 1n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked - amount,
    rate: 0n,
  });
});

ponder.on("DepositPoolUSDT:UserClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const pool = await getOrCreateDepositPool(rewardPoolIndex, depositPoolAddress, context);
  const userRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(user)
    .set({
      claimed: userRecord.claimed + amount,
    })
    .where(eq(user.id, userRecord.id));

  const counter = await getOrIncrementInteractionCount(event.transaction.hash, context);
  const interactionId = createPoolInteractionId(event.transaction.hash, counter);
  
  await context.db.insert(poolInteraction).values({
    id: interactionId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    userId: userRecord.id,
    type: 2n,
    amount: amount,
    depositPool: depositPoolAddress,
    totalStaked: pool.totalStaked,
    rate: 0n,
  });
});

ponder.on("DepositPoolUSDT:UserReferred", async ({ event, context }: any) => {
  const { rewardPoolIndex, user, referrer: referrerAddress, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referralUserRecord = await getOrCreateUser(user, rewardPoolIndex, depositPoolAddress, context);
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  let referrerRecord = await context.db
    .select()
    .from(referrer)
    .where(eq(referrer.userId, referrerUserRecord.id))
    .limit(1);

  if (referrerRecord.length === 0) {
    await context.db.insert(referrer).values({
      id: referrerUserRecord.id,
      userId: referrerUserRecord.id,
      referrerAddress: referrerAddress,
      claimed: 0n,
    });
    
    referrerRecord = await context.db
      .select()
      .from(referrer)
      .where(eq(referrer.userId, referrerUserRecord.id))
      .limit(1);
  }
  
  const referralId = createUserId(user, referrerAddress, rewardPoolIndex);
  await context.db.insert(referral).values({
    id: referralId,
    referralUserId: referralUserRecord.id,
    referrerId: referrerRecord[0].id,
    referralAddress: user,
    referrerAddress: referrerAddress,
    amount: amount,
  });
});

ponder.on("DepositPoolUSDT:ReferrerClaimed", async ({ event, context }: any) => {
  const { rewardPoolIndex, referrer: referrerAddress, receiver, amount } = event.args;
  const depositPoolAddress = event.log.address;
  
  const referrerUserRecord = await getOrCreateUser(referrerAddress, rewardPoolIndex, depositPoolAddress, context);
  
  await context.db
    .update(referrer)
    .set({
      claimed: sql`${referrer.claimed} + ${amount}`,
    })
    .where(eq(referrer.userId, referrerUserRecord.id));
});
