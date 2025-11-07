# Environment Variables Documentation

This document describes all environment variables used by the Builders V4 indexer.

## Required Variables

### `DATABASE_URL`
- **Type**: String
- **Format**: `postgresql://username:password@host:port/database?sslmode=require`
- **Description**: PostgreSQL connection string for the production database
- **Example**: `postgresql://user:pass@db.example.com:25060/builders_v4_db?sslmode=require`
- **Source**: Provided by DigitalOcean Managed Database or App Platform database component

### `DATABASE_SCHEMA`
- **Type**: String
- **Description**: Unique database schema name per deployment. Used for zero-downtime deployments.
- **Default**: `builders_v4_prod`
- **Usage**: In DigitalOcean App Platform, use `$APP_DEPLOYMENT_ID` for automatic schema per deployment
- **Note**: Each deployment should have a unique schema to isolate data

### `PONDER_RPC_URL_84532`
- **Type**: String
- **Description**: RPC endpoint URL for Base Sepolia chain (chain ID: 84532)
- **Default**: `https://sepolia.base.org` (public endpoint, may be rate-limited)
- **Recommendation**: Use a paid RPC provider (Alchemy, Infura, QuickNode) for production
- **Example**: `https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY`

## Optional Variables

### `PONDER_LOG_LEVEL`
- **Type**: String
- **Values**: `trace`, `debug`, `info`, `warn`, `error`
- **Default**: `info`
- **Description**: Minimum log level for Ponder. Controls verbosity of logs.

### Contract Address Overrides

These variables allow overriding contract addresses and start blocks defined in `ponder.config.ts`:

- `BUILDERS_V4_CONTRACT_ADDRESS`: Builders V4 staking contract address
- `BUILDERS_V4_START_BLOCK`: Block number to start indexing from
- `REWARD_POOL_V4_CONTRACT_ADDRESS`: Reward Pool V4 contract address
- `REWARD_POOL_V4_START_BLOCK`: Start block for Reward Pool V4
- `BUILDERS_TREASURY_V2_CONTRACT_ADDRESS`: Builders Treasury V2 contract address
- `BUILDERS_TREASURY_V2_START_BLOCK`: Start block for Builders Treasury V2
- `FEE_CONFIG_CONTRACT_ADDRESS`: Fee Config contract address
- `FEE_CONFIG_START_BLOCK`: Start block for Fee Config
- `MOR_TOKEN_ADDRESS_BASE_SEPOLIA`: MOR token contract address on Base Sepolia
- `MOR_TOKEN_START_BLOCK_BASE_SEPOLIA`: Start block for MOR token

## DigitalOcean App Platform Specific

When deploying to DigitalOcean App Platform:

1. **DATABASE_URL**: Automatically provided as `${db.DATABASE_URL}` when database component is linked
2. **DATABASE_SCHEMA**: Use `$APP_DEPLOYMENT_ID` for automatic unique schemas per deployment
3. **Other variables**: Set manually in App Platform environment variables section

## Local Development

For local development, create a `.env.local` file (not committed to git) with your local values:

```bash
DATABASE_URL=postgresql://localhost:5432/builders_v4_dev
DATABASE_SCHEMA=builders_v4_dev
PONDER_RPC_URL_84532=https://sepolia.base.org
PONDER_LOG_LEVEL=debug
```

