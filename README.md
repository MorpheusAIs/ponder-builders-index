# MorpheusAI Ponder Indexing Monorepo

A monorepo containing Ponder-based blockchain indexers for MorpheusAI's smart contracts and data infrastructure.

## Architecture

This monorepo follows the recommended Ponder architecture pattern with:

- **Multi-domain Ponder apps**: Separate indexers for different contract domains
- **Factory pattern support**: Dynamic contract discovery for child contracts
- **Multi-chain indexing**: Support for Arbitrum and Base mainnet
- **Dual API approach**: GraphQL for frontend queries + SQL over HTTP for analytics
- **Migration strategy**: Apollo Federation for gradual cutover from existing subgraphs

## Structure

```
├── apps/
│   ├── ponder-builders/          # Builders staking contracts indexer
│   ├── ponder-capital/           # Capital module contracts indexer (future)
│   └── ponder-subnets/           # Subnet contracts indexer (future)
├── gateway/
│   └── apollo-federation/        # GraphQL federation layer
├── infrastructure/
│   ├── docker-compose.yml       # Local development setup
│   └── kubernetes/               # Production deployment configs
├── packages/
│   ├── shared-abis/             # Shared contract ABIs
│   └── shared-types/            # Shared TypeScript types
└── scripts/
    ├── setup.sh                # Initial setup script
    └── migrate-subgraph.js      # Subgraph migration utilities
```

## Networks & Contracts

### Arbitrum Mainnet (Chain ID: 42161)
- **Builders Contract**: `0xC0eD68f163d44B6e9985F0041fDf6f67c6BCFF3f`
- **MOR20 Token**: `0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86`
- **L2 Factory**: `0x890bfa255e6ee8db5c67ab32dc600b14ebc4546c`
- **Subnet Factory**: `0x37b94bd80b6012fb214bb6790b31a5c40d6eb7a5`

### Base Mainnet (Chain ID: 8453)
- **Builders Contract**: `0x42BB446eAE6dca7723a9eBdb81EA88aFe77eF4B9`
- **MOR20 Token**: `0x7431ADA8A591C955A994A21710752ef9b882b8e3`

## Existing Subgraph Migration

### Current GraphQL Endpoints
- **Base**: `https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api`
- **Arbitrum**: `https://api.studio.thegraph.com/query/73688/lumerin-node/version/latest`

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (for local development)

### Quick Start

1. **Clone and setup**:
```bash
git clone <this-repo>
cd ponder-builders-index
./scripts/setup.sh  # This will install dependencies and create .env files
```

2. **Configure your RPC endpoints**:
```bash
# Edit the generated .env files with your own RPC URLs
# apps/ponder-builders/.env - Add your Alchemy/Infura/QuickNode URLs
# gateway/apollo-federation/.env - Configure federation endpoints
```

3. **Start local infrastructure**:
```bash
docker-compose -f infrastructure/docker-compose.yml up -d
```

4. **Start the Builders indexer**:
```bash
cd apps/ponder-builders
npm run dev
```

5. **Access APIs**:
- GraphQL: http://localhost:42069/graphql
- SQL over HTTP: http://localhost:42069/sql
- Health check: http://localhost:42069/health

## Development

Each Ponder app is independently deployable but shares common configuration:

- **Database**: PostgreSQL with schema-per-deployment pattern
- **APIs**: Auto-generated GraphQL + SQL over HTTP endpoints
- **Hot reload**: Development servers with automatic code reloading
- **Type safety**: Full TypeScript support with generated types

## Deployment

Production deployment uses:

- **Database views pattern**: Zero-downtime deployments with schema versioning
- **Horizontal scaling**: Multiple Ponder instances behind load balancers
- **Apollo Federation**: Single GraphQL endpoint combining all indexers
- **Monitoring**: Comprehensive logging and health checks

## Migration Strategy

The migration from existing subgraphs follows a phased approach:

1. **Phase 1**: Deploy Ponder indexers alongside existing subgraphs
2. **Phase 2**: Set up Apollo Federation combining both data sources
3. **Phase 3**: Gradually migrate queries from legacy subgraphs to Ponder
4. **Phase 4**: Decommission legacy subgraphs when migration is complete

## Development Notes

### Environment Configuration
- **`.env` files are gitignored** - they contain sensitive RPC URLs and database credentials
- **Setup script creates `.env` files** automatically with template values
- **Update RPC URLs** before starting development - default public RPCs may be rate-limited
- **Use production RPC providers** (Alchemy, Infura, QuickNode) for reliable indexing

### Git Configuration
The repository includes a comprehensive `.gitignore` that excludes:
- Environment files (`.env`, `.env.local`, etc.)
- Node.js dependencies (`node_modules/`)
- Build outputs (`dist/`, `build/`)
- Database files (`.ponder/`, `*.db`)
- IDE files (`.vscode/`, `.idea/`)
- OS-specific files (`.DS_Store`, `Thumbs.db`)
- Generated files (`schema.graphql`, `supergraph-schema.graphql`)

### Database Setup
- **PostgreSQL is required** - use Docker Compose for local development
- **Each Ponder app uses a separate database** schema for isolation
- **Database views pattern** enables zero-downtime deployments

## Documentation

- [Builders Contracts Documentation](./docs/builders%20contracts.md)
- [Ponder Architecture Brief](./docs/Ponder%20architecture%20brief.md)
- [Complete Architecture Guide](./docs/Ponder%20Blockchain%20Indexing%20Architectur.md)
