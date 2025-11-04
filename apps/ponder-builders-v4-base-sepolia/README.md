# Builders v4 Base Sepolia Indexer

Ponder-based indexer for Builders Protocol v4 contracts deployed on Base Sepolia testnet.

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with the required configuration (see setup guide below).

3. **Run the indexer:**
   ```bash
   pnpm dev
   ```

## Documentation

For detailed setup instructions, configuration, and troubleshooting, see:
- **[Setup Guide](../../docs/builders-v4-base-sepolia-setup.md)**

## Configuration

Update the following in `ponder.config.ts` or `.env`:
- Contract addresses (from [GitBook documentation](https://gitbook.mor.org/smart-contracts/documentation/builders-protocol/deployed-contracts))
- Start block numbers
- RPC endpoint URL

## Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm start` - Start production server
- `pnpm db` - Database management commands
- `pnpm codegen` - Generate TypeScript types
- `pnpm typecheck` - Type check the codebase

## API Endpoints

- GraphQL: `http://localhost:42069/graphql`
- GraphQL Playground: `http://localhost:42069`
- SQL API: `http://localhost:42069/sql/*`
- Health: `http://localhost:42069/health`

## Contract Information

Contract addresses and deployment information can be found at:
https://gitbook.mor.org/smart-contracts/documentation/builders-protocol/deployed-contracts
