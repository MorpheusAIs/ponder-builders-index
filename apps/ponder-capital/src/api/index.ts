import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql, eq, desc, asc, count, sum } from "ponder";

const app = new Hono();

// Enable SQL over HTTP for direct database queries
app.use("/sql/*", client({ db, schema }));

// Enable GraphQL API for structured queries  
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// Custom REST endpoints matching existing subgraph structure
app.get("/api/stats", async (c: any) => {
  try {
    // Get total deposit pools
    const poolCount = await db
      .select({ count: count() })
      .from(schema.depositPool);

    // Get total users
    const userCount = await db
      .select({ count: count() })
      .from(schema.user);

    // Get total staked across all pools
    const totalStaked = await db
      .select({ 
        total: sum(schema.depositPool.totalStaked)
      })
      .from(schema.depositPool);

    // Get total claimed across all users
    const totalClaimed = await db
      .select({
        total: sum(schema.user.claimed)
      })
      .from(schema.user);

    return c.json({
      totalDepositPools: poolCount[0]?.count || 0,
      totalUsers: userCount[0]?.count || 0,
      totalStaked: totalStaked[0]?.total?.toString() || "0",
      totalClaimed: totalClaimed[0]?.total?.toString() || "0",
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

app.get("/api/pools", async (c: any) => {
  try {
    const pools = await db
      .select()
      .from(schema.depositPool)
      .limit(100);

    return c.json(pools.map((pool: any) => ({
      id: pool.id,
      rewardPoolId: pool.rewardPoolId.toString(),
      depositPool: pool.depositPool,
      totalStaked: pool.totalStaked.toString()
    })));
  } catch (error) {
    return c.json({ error: "Failed to fetch pools" }, 500);
  }
});

app.get("/api/users", async (c: any) => {
  try {
    const users = await db
      .select()
      .from(schema.user)
      .orderBy([desc(schema.user.staked)])
      .limit(100);

    return c.json(users.map((user: any) => ({
      id: user.id,
      address: user.address,
      rewardPoolId: user.rewardPoolId.toString(),
      depositPool: user.depositPool,
      staked: user.staked.toString(),
      claimed: user.claimed.toString()
    })));
  } catch (error) {
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

app.get("/api/pool/:poolId/users", async (c: any) => {
  const poolId = c.req.param("poolId") as `0x${string}`;
  
  try {
    const users = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.depositPool, poolId))
      .orderBy([desc(schema.user.staked)])
      .limit(100);

    return c.json(users.map((user: any) => ({
      id: user.id,
      address: user.address,
      rewardPoolId: user.rewardPoolId.toString(),
      staked: user.staked.toString(),
      claimed: user.claimed.toString()
    })));
  } catch (error) {
    return c.json({ error: "Failed to fetch pool users" }, 500);
  }
});

app.get("/api/interactions", async (c: any) => {
  try {
    const interactions = await db
      .select()
      .from(schema.poolInteraction)
      .orderBy([desc(schema.poolInteraction.blockTimestamp)])
      .limit(100);

    return c.json(interactions.map((interaction: any) => ({
      id: interaction.id,
      blockNumber: interaction.blockNumber.toString(),
      blockTimestamp: interaction.blockTimestamp.toString(),
      transactionHash: interaction.transactionHash,
      userId: interaction.user,
      type: interaction.type.toString(),
      amount: interaction.amount.toString(),
      depositPool: interaction.depositPool,
      totalStaked: interaction.totalStaked.toString(),
      rate: interaction.rate.toString()
    })));
  } catch (error) {
    return c.json({ error: "Failed to fetch interactions" }, 500);
  }
});

app.get("/api/user/:userId/interactions", async (c: any) => {
  const userId = c.req.param("userId") as `0x${string}`;
  
  try {
    const interactions = await db
      .select()
      .from(schema.poolInteraction)
      .where(eq(schema.poolInteraction.user, userId))
      .orderBy([desc(schema.poolInteraction.blockTimestamp)])
      .limit(100);

    return c.json(interactions.map((interaction: any) => ({
      id: interaction.id,
      blockNumber: interaction.blockNumber.toString(),
      blockTimestamp: interaction.blockTimestamp.toString(),
      transactionHash: interaction.transactionHash,
      type: interaction.type.toString(),
      amount: interaction.amount.toString(),
      depositPool: interaction.depositPool,
      totalStaked: interaction.totalStaked.toString(),
      rate: interaction.rate.toString()
    })));
  } catch (error) {
    return c.json({ error: "Failed to fetch user interactions" }, 500);
  }
});

app.get("/api/referrals", async (c: any) => {
  try {
    const referrals = await db
      .select()
      .from(schema.referral)
      .limit(100);

    return c.json(referrals.map((referral: any) => ({
      id: referral.id,
      referralUserId: referral.referral,
      referrerId: referral.referrer,
      referralAddress: referral.referralAddress,
      referrerAddress: referral.referrerAddress,
      amount: referral.amount.toString()
    })));
  } catch (error) {
    return c.json({ error: "Failed to fetch referrals" }, 500);
  }
});

app.get("/api/referrers", async (c: any) => {
  try {
    const referrers = await db
      .select()
      .from(schema.referrer)
      .orderBy([desc(schema.referrer.claimed)])
      .limit(100);

    return c.json(referrers.map((referrer: any) => ({
      id: referrer.id,
      userId: referrer.userId,
      referrerAddress: referrer.referrerAddress,
      claimed: referrer.claimed.toString()
    })));
  } catch (error) {
    return c.json({ error: "Failed to fetch referrers" }, 500);
  }
});

// Health check endpoint for DigitalOcean
app.get("/health", async (c) => {
  try {
    // Simple database connectivity check
    await db.select().from(schema.depositPool).limit(1);
    return c.json({ status: "healthy", timestamp: Date.now() });
  } catch (error) {
    return c.json({ status: "unhealthy", error: String(error) }, 503);
  }
});

// Ready endpoint - check database connectivity
app.get("/ready", async (c) => {
  try {
    await db.select().from(schema.depositPool).limit(1);
    return c.json({ status: "ready", timestamp: Date.now() });
  } catch (error) {
    return c.json({ status: "not ready", error: String(error) }, 503);
  }
});

export default app;