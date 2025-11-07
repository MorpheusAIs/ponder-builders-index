import { ponder } from "ponder:registry";
import { 
  buildersProject, 
  buildersUser, 
  stakingEvent, 
  morTransfer, 
  dynamicSubnet, 
  rewardDistribution,
  counters 
} from "ponder:schema";
import { isAddressEqual } from "viem";

// Helper function to create composite user ID
const createUserId = (projectId: string, userAddress: string) => 
  `${projectId}-${userAddress.toLowerCase()}`;

// Helper function to get or create counters
const getOrCreateCounters = async (context: any, timestamp: number) => {
  let counter = await context.db.find(counters, { id: "global" });

  if (!counter) {
    await context.db.insert(counters).values({
      id: "global",
      totalBuildersProjects: 0,
      totalSubnets: 0,
      totalStaked: 0n,
      totalUsers: 0,
      lastUpdated: timestamp,
    });
    
    counter = await context.db.find(counters, { id: "global" });
  }

  return counter;
};

// Builders Contract Events

ponder.on("BuildersV4:SubnetCreated", async ({ event, context }: any) => {
  const { subnetId, subnet } = event.args;
  
  // subnet is a tuple with: name, admin, unusedStorage1_V4Update, withdrawLockPeriodAfterDeposit, unusedStorage2_V4Update, minimalDeposit, claimAdmin
  const { name, admin, withdrawLockPeriodAfterDeposit, minimalDeposit } = subnet;

  // Check if project already exists (can happen if SubnetMetadataEdited was processed first)
  let existingProject = await context.db.find(buildersProject, { id: subnetId });

  // Read metadata from contract (metadata is set during creation but not emitted in event)
  const metadata = await context.client.readContract({
    address: event.log.address,
    abi: context.contracts.BuildersV4.abi,
    functionName: "subnetsMetadata",
    args: [subnetId],
  });

  const [slug, description, website, image] = metadata;

  const blockTimestamp = Number(event.block.timestamp);

  if (!existingProject) {
    // Create the builders project (subnet)
    await context.db.insert(buildersProject).values({
      id: subnetId,
      name: name,
      admin: admin,
      totalStaked: 0n,
      totalUsers: 0,
      totalClaimed: 0n,
      minimalDeposit: minimalDeposit,
      withdrawLockPeriodAfterDeposit: withdrawLockPeriodAfterDeposit,
      claimLockEnd: BigInt(blockTimestamp) + BigInt(withdrawLockPeriodAfterDeposit),
      startsAt: BigInt(blockTimestamp),
      chainId: context.chain.id,
      contractAddress: event.log.address,
      createdAt: blockTimestamp,
      createdAtBlock: event.block.number,
      slug: slug || null,
      description: description || null,
      website: website || null,
      image: image || null,
    });

    // Update counters
    const counter = await getOrCreateCounters(context, blockTimestamp);
    await context.db
      .update(counters, { id: "global" })
      .set({
        totalBuildersProjects: counter.totalBuildersProjects + 1,
        totalSubnets: counter.totalSubnets + 1,
        lastUpdated: blockTimestamp,
      });
  } else {
    // Project already exists (created by SubnetMetadataEdited), update it with subnet data
    await context.db
      .update(buildersProject, { id: subnetId })
      .set({
        name: name,
        admin: admin,
        minimalDeposit: minimalDeposit,
        withdrawLockPeriodAfterDeposit: withdrawLockPeriodAfterDeposit,
        claimLockEnd: BigInt(blockTimestamp) + BigInt(withdrawLockPeriodAfterDeposit),
        startsAt: BigInt(blockTimestamp),
        slug: slug || existingProject.slug,
        description: description || existingProject.description,
        website: website || existingProject.website,
        image: image || existingProject.image,
      });
  }
});

ponder.on("BuildersV4:UserDeposited", async ({ event, context }: any) => {
  const { subnetId, user, amount } = event.args;
  
  const userId = createUserId(subnetId, user);
  
  // Create staking event record
  const blockTimestamp = Number(event.block.timestamp);
  await context.db.insert(stakingEvent).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    buildersProjectId: subnetId,
    userAddress: user,
    eventType: "DEPOSIT",
    amount: amount,
    blockNumber: event.block.number,
    blockTimestamp: blockTimestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    chainId: context.chain.id,
  });

  // Get current user data from contract
  const userData = await context.client.readContract({
    address: event.log.address,
    abi: context.contracts.BuildersV4.abi,
    functionName: "usersData",
    args: [user, subnetId],
  });

  const [lastDeposit, unusedStorage1_V4Update, deposited, unusedStorage2_V4Update] = userData;

  // Check if user already exists
  const existingUser = await context.db.find(buildersUser, { id: userId });
  
  // Get current project totals
  const project = await context.db.find(buildersProject, { id: subnetId });
  if (!project) {
    throw new Error(`Project ${subnetId} not found`);
  }

  // Calculate incremental changes
  const oldStaked = existingUser?.staked || 0n;
  const stakedDelta = deposited - oldStaked;
  const isNewUser = !existingUser;

  // Upsert user record
  await context.db
    .insert(buildersUser)
    .values({
      id: userId,
      buildersProjectId: subnetId,
      address: user,
      staked: deposited,
      claimed: existingUser?.claimed || 0n,
      lastStake: BigInt(blockTimestamp),
      claimLockEnd: BigInt(lastDeposit),
      lastDeposit: lastDeposit,
      virtualDeposited: unusedStorage2_V4Update,
      chainId: context.chain.id,
    })
    .onConflictDoUpdate({
      target: [buildersUser.id],
      set: {
        staked: deposited,
        lastStake: BigInt(blockTimestamp),
        claimLockEnd: BigInt(lastDeposit),
        lastDeposit: lastDeposit,
        virtualDeposited: unusedStorage2_V4Update,
      },
    });

  // Update project totals incrementally
  await context.db
    .update(buildersProject, { id: subnetId })
    .set({
      totalStaked: project.totalStaked + stakedDelta,
      totalUsers: isNewUser ? project.totalUsers + 1 : project.totalUsers,
    });
});

ponder.on("BuildersV4:UserWithdrawn", async ({ event, context }: any) => {
  const { subnetId, user, amount } = event.args;
  
  const userId = createUserId(subnetId, user);
  
  // Create staking event record
  const blockTimestamp = Number(event.block.timestamp);
  await context.db.insert(stakingEvent).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    buildersProjectId: subnetId,
    userAddress: user,
    eventType: "WITHDRAW",
    amount: amount,
    blockNumber: event.block.number,
    blockTimestamp: blockTimestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    chainId: context.chain.id,
  });

  // Get updated user data from contract
  const userData = await context.client.readContract({
    address: event.log.address,
    abi: context.contracts.BuildersV4.abi,
    functionName: "usersData",
    args: [user, subnetId],
  });

  const [lastDeposit, unusedStorage1_V4Update, deposited, unusedStorage2_V4Update] = userData;

  // Get current user and project records
  const existingUser = await context.db.find(buildersUser, { id: userId });
  const project = await context.db.find(buildersProject, { id: subnetId });
  
  if (!existingUser || !project) {
    throw new Error(`User ${userId} or project ${subnetId} not found`);
  }

  // Calculate incremental change
  const oldStaked = existingUser.staked;
  const stakedDelta = deposited - oldStaked;

  // Update user record
  await context.db
    .update(buildersUser, { id: userId })
    .set({
      staked: deposited,
      lastDeposit: lastDeposit,
      virtualDeposited: unusedStorage2_V4Update,
    });

  // Update project totals incrementally
  await context.db
    .update(buildersProject, { id: subnetId })
    .set({
      totalStaked: project.totalStaked + stakedDelta,
    });
});

// Subnet Metadata Updates
ponder.on("BuildersV4:SubnetMetadataEdited", async ({ event, context }: any) => {
  const { subnetId_, metadata_ } = event.args;
  
  const { slug, description, website, image } = metadata_;

  // Check if project exists
  let project = await context.db.find(buildersProject, { id: subnetId_ });

  // If project doesn't exist, create it by reading from contract
  // This can happen if metadata is edited in the same transaction as creation
  if (!project) {
    const blockTimestamp = Number(event.block.timestamp);
    
    // Read subnet data from contract
    const subnetData = await context.client.readContract({
      address: event.log.address,
      abi: context.contracts.BuildersV4.abi,
      functionName: "subnets",
      args: [subnetId_],
    });

    const [name, admin, unusedStorage1_V4Update, withdrawLockPeriodAfterDeposit, unusedStorage2_V4Update, minimalDeposit, claimAdmin] = subnetData;

    // Create the project
    await context.db.insert(buildersProject).values({
      id: subnetId_,
      name: name,
      admin: admin,
      totalStaked: 0n,
      totalUsers: 0,
      totalClaimed: 0n,
      minimalDeposit: minimalDeposit,
      withdrawLockPeriodAfterDeposit: withdrawLockPeriodAfterDeposit,
      claimLockEnd: BigInt(blockTimestamp) + BigInt(withdrawLockPeriodAfterDeposit),
      startsAt: BigInt(blockTimestamp),
      chainId: context.chain.id,
      contractAddress: event.log.address,
      createdAt: blockTimestamp,
      createdAtBlock: event.block.number,
      slug: slug || null,
      description: description || null,
      website: website || null,
      image: image || null,
    });

    // Update counters
    const counter = await getOrCreateCounters(context, blockTimestamp);
    await context.db
      .update(counters, { id: "global" })
      .set({
        totalBuildersProjects: counter.totalBuildersProjects + 1,
        totalSubnets: counter.totalSubnets + 1,
        lastUpdated: blockTimestamp,
      });
  } else {
    // Update project metadata
    await context.db
      .update(buildersProject, { id: subnetId_ })
      .set({
        slug: slug || null,
        description: description || null,
        website: website || null,
        image: image || null,
      });
  }
});

// Note: BuildersV4 doesn't have a Claimed event for users
// Claims are handled through the BuildersTreasuryV2 contract
// AdminClaimed event exists but is for admin rewards, not user rewards

// MOR Token Transfer Events
ponder.on("MorToken:Transfer", async ({ event, context }: any) => {
  const { from, to, value } = event.args;
  
  // Check if this transfer is related to builders staking
  // (i.e., to/from the Builders contract address)
  // Get the address from contract configuration to ensure it's always valid
  const buildersAddress = context.contracts.BuildersV4.address;
  
  if (!buildersAddress || buildersAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "BUILDERS_V4_CONTRACT_ADDRESS is not configured or is set to zero address. " +
      "Please set BUILDERS_V4_CONTRACT_ADDRESS environment variable to a valid contract address."
    );
  }
  
  const isStakingRelated = 
    isAddressEqual(to as `0x${string}`, buildersAddress as `0x${string}`) || 
    isAddressEqual(from as `0x${string}`, buildersAddress as `0x${string}`);
  
  let isStakingDeposit = false;
  let isStakingWithdraw = false;
  let relatedProjectId = null;
  
  if (isStakingRelated) {
    isStakingDeposit = isAddressEqual(to as `0x${string}`, buildersAddress as `0x${string}`);
    isStakingWithdraw = isAddressEqual(from as `0x${string}`, buildersAddress as `0x${string}`);
  }

  await context.db.insert(morTransfer).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    from: from,
    to: to,
    value: value,
    blockNumber: event.block.number,
    blockTimestamp: Number(event.block.timestamp),
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    chainId: context.chain.id,
    isStakingDeposit,
    isStakingWithdraw,
    relatedProjectId,
  });
});

// BuildersTreasuryV2 Reward Distribution Events
ponder.on("BuildersTreasuryV2:RewardSent", async ({ event, context }: any) => {
  const { receiver, amount } = event.args;
  
  await context.db.insert(rewardDistribution).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    receiver: receiver,
    amount: amount,
    blockNumber: event.block.number,
    blockTimestamp: Number(event.block.timestamp),
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    chainId: context.chain.id,
    treasuryAddress: event.log.address,
  });
});
