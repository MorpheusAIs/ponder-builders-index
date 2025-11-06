# Builders v4 Base Sepolia Indexer - Local Setup Guide

This document provides step-by-step instructions for setting up and running the Builders v4 contracts indexer for Base Sepolia locally.

## Overview

The Builders v4 Base Sepolia indexer (`ponder-builders-v4-base-sepolia`) is a Ponder-based indexer that tracks events from the Builders Protocol v4 contracts deployed on Base Sepolia testnet. It indexes:

- Builder pool creation events
- User deposits, withdrawals, and claims
- MOR token transfers related to staking
- Pool and user statistics

## Prerequisites

1. **Node.js** (>= 18.14) and npm/pnpm installed
2. **PostgreSQL** database (local or remote)
3. **Base Sepolia RPC endpoint** (free public RPCs available, or use your own)
4. **Contract addresses** from the [official documentation](https://gitbook.mor.org/smart-contracts/documentation/builders-protocol/deployed-contracts)

## Step 1: Install Dependencies

From the workspace root directory:

```bash
# Install dependencies for all workspaces
pnpm install

# Or if using npm
npm install
```

## Step 2: Set Up Environment Variables

Create a `.env` file in the `apps/ponder-builders-v4-base-sepolia/` directory:

```bash
cd apps/ponder-builders-v4-base-sepolia
touch .env
```

Add the following environment variables to `.env`:

```env
# Database Configuration
# Use a local PostgreSQL instance or connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ponder_builders_v4

# Base Sepolia RPC Configuration
# Option 1: Use public RPC (free, rate-limited)
PONDER_RPC_URL_84532=https://sepolia.base.org

# Option 2: Use your own RPC endpoint (recommended for production)
# PONDER_RPC_URL_84532=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Contract Addresses (Update these with actual addresses from GitBook documentation)
# Get these from: https://gitbook.mor.org/smart-contracts/documentation/builders-protocol/deployed-contracts
BUILDERS_V4_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
MOR_TOKEN_ADDRESS_BASE_SEPOLIA=0x0000000000000000000000000000000000000000

# Start Block Numbers (Update with actual deployment block numbers)
BUILDERS_V4_START_BLOCK=0
MOR_TOKEN_START_BLOCK_BASE_SEPOLIA=0
```

### Important: Update Contract Addresses

**Before running the indexer**, you must update the contract addresses in either:
1. The `.env` file (as shown above), or
2. The `ponder.config.ts` file directly

The contract addresses can be found in the [Builders Protocol Deployed Contracts documentation](https://gitbook.mor.org/smart-contracts/documentation/builders-protocol/deployed-contracts).

## Step 3: Set Up PostgreSQL Database

### Option A: Using Docker (Recommended)

If you have Docker installed, you can use the existing docker-compose setup:

```bash
# From the workspace root
cd infrastructure
docker-compose up -d
```

This will start a PostgreSQL instance. The connection string should be configured in your `.env` file.

### Option B: Using Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create database
createdb ponder_builders_v4

# Or using psql
psql -U postgres -c "CREATE DATABASE ponder_builders_v4;"
```

Update your `DATABASE_URL` in `.env` accordingly.

## Step 4: Initialize the Database Schema

Ponder will automatically create the database schema when you first run the indexer. However, you can also manually initialize it:

```bash
cd apps/ponder-builders-v4-base-sepolia
pnpm db migrate
```

Or if using npm:

```bash
npm run db migrate
```

## Step 5: Run the Indexer

### Development Mode (with hot reload)

From the `apps/ponder-builders-v4-base-sepolia` directory:

```bash
pnpm dev
```

Or from the workspace root:

```bash
pnpm --filter @morpheusai/ponder-builders-v4-base-sepolia dev
```

### Production Mode

```bash
pnpm start
```

The indexer will:
1. Connect to the Base Sepolia RPC endpoint
2. Create database tables if they don't exist
3. Start indexing from the configured `startBlock`
4. Expose a GraphQL API at `http://localhost:42069` (default port)
5. Expose a SQL API at `http://localhost:42069/sql`

## Step 6: Verify the Indexer is Running

### Check Indexer Status

The indexer provides a health endpoint:
```bash
curl http://localhost:42069/health
```

### Query GraphQL API

You can query the GraphQL API to verify data is being indexed:

```bash
curl -X POST http://localhost:42069/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ buildersProjects { id name totalStaked totalUsers } }"
  }'
```

### Access GraphQL Playground

Open your browser and navigate to:
```
http://localhost:42069
```

This will open the Ponder GraphQL playground where you can explore the schema and run queries interactively.

## Available GraphQL Queries

Once the indexer is running, you can query the following entities:

### Builders Projects
```graphql
query {
  buildersProjects {
    id
    name
    admin
    totalStaked
    totalUsers
    totalClaimed
    minimalDeposit
    withdrawLockPeriodAfterDeposit
    claimLockEnd
    startsAt
    chainId
    contractAddress
    createdAt
    createdAtBlock
  }
}
```

### Builders Users
```graphql
query {
  buildersUsers {
    id
    address
    staked
    claimed
    lastStake
    claimLockEnd
    lastDeposit
    virtualDeposited
    chainId
    buildersProject {
      id
      name
    }
  }
}
```

### Staking Events
```graphql
query {
  stakingEvents {
    id
    eventType
    amount
    blockNumber
    blockTimestamp
    transactionHash
    userAddress
    buildersProject {
      id
      name
    }
  }
}
```

### Counters
```graphql
query {
  counters {
    id
    totalBuildersProjects
    totalSubnets
    totalStaked
    totalUsers
    lastUpdated
  }
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify PostgreSQL is running
   - Check `DATABASE_URL` in `.env`
   - Ensure database exists

2. **RPC Connection Error**
   - Verify `PONDER_RPC_URL_84532` is correct
   - Check if the RPC endpoint is accessible
   - Consider using a different RPC provider if rate-limited

3. **Contract Address Error**
   - Ensure contract addresses are updated in `.env` or `ponder.config.ts`
   - Verify addresses are valid Ethereum addresses on Base Sepolia
   - Check that contracts are deployed on Base Sepolia (chain ID 84532)

4. **Start Block Issues**
   - If indexing from block 0 is slow, set a more recent start block
   - Use the actual deployment block number for faster initial sync

5. **Port Already in Use**
   - Change the port in Ponder configuration or stop other services using port 42069

### Reset the Database

If you need to start fresh:

```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS ponder_builders_v4;"
psql -U postgres -c "CREATE DATABASE ponder_builders_v4;"

# Restart the indexer - it will recreate the schema
pnpm dev
```

## Project Structure

```
apps/ponder-builders-v4-base-sepolia/
├── src/
│   ├── api/
│   │   └── index.ts          # API routes (GraphQL, SQL)
│   └── index.ts              # Event handlers
├── ponder.config.ts          # Ponder configuration (chains, contracts)
├── ponder.schema.ts          # Database schema definitions
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── ponder-env.d.ts           # Type definitions
└── .env                      # Environment variables (create this)
```

## Next Steps

1. **Update Contract Addresses**: Get the actual contract addresses from the GitBook documentation
2. **Set Start Blocks**: Configure the deployment block numbers for faster initial sync
3. **Configure RPC**: Use a reliable RPC endpoint (consider using Alchemy, Infura, or QuickNode)
4. **Monitor Indexing**: Watch the console output to track indexing progress
5. **Query Data**: Use GraphQL or SQL APIs to query indexed data

## Additional Resources

- [Ponder Documentation](https://ponder.sh/docs)
- [Base Sepolia Explorer](https://sepolia.basescan.org)
- [Builders Protocol Documentation](https://gitbook.mor.org/smart-contracts/documentation/builders-protocol/deployed-contracts)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Ponder documentation
3. Check the contract deployment documentation on GitBook
