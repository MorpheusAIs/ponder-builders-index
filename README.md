# MorpheusAI Ponder Indexing Monorepo

A monorepo containing Ponder-based blockchain indexers for MorpheusAI's smart contracts and data infrastructure.

## Architecture

This monorepo follows the recommended Ponder architecture pattern with:

- **Multi-domain Ponder apps**: Separate indexers for different contract domains
- **Factory pattern support**: Dynamic contract discovery for child contracts  
- **Multi-chain indexing**: Support for Ethereum, Arbitrum and Base mainnet
- **Dual API approach**: GraphQL for frontend queries + SQL over HTTP for analytics
- **Migration strategy**: Apollo Federation for gradual cutover from existing subgraphs
- **Complete subgraph compatibility**: Drop-in replacement for existing GraphQL APIs

## Structure

```
├── apps/
│   ├── ponder-builders/          # Builders staking contracts indexer
│   ├── ponder-capital/           # Capital deposit pools indexer 
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

### Ethereum Mainnet (Chain ID: 1) - Capital Module
- **Deposit Pool stETH**: `0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790`
- **Deposit Pool WBTC**: `0xdE283F8309Fd1AA46c95d299f6B8310716277A42`
- **Deposit Pool WETH**: `0x9380d72aBbD6e0Cc45095A2Ef8c2CA87d77Cb384`
- **Deposit Pool USDC**: `0x6cCE082851Add4c535352f596662521B4De4750E`
- **Deposit Pool USDT**: `0x3B51989212BEdaB926794D6bf8e9E991218cf116`
- **Distributor**: `0xDf1AC1AC255d91F5f4B1E3B4Aef57c5350F64C7A`
- **L1 Sender V2**: `0x50e80ea310269c547b64cc8b8a606be0ec467d1f`
- **ChainLink Data Consumer**: `0x94e6720a624ea275b44d357a7f21bfcf09ff7e11`
- **Reward Pool**: `0xe30279b79392aeff7fdf1883c23d52eba9d88a75`

### Capital Module Cross-Chain
- **L2 Message Receiver (Arbitrum)**: `0xd4a8ECcBe696295e68572A98b1aA70Aa9277d427`

## Existing Subgraph Migration

### Current GraphQL Endpoints
- **Base**: `https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api`
- **Arbitrum**: `https://api.studio.thegraph.com/query/73688/morpheus-mainnet-arbitrum/version/latest`
- **Capital**: `https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest`

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
# apps/ponder-builders/.env - Add your Arbitrum & Base RPC URLs
# apps/ponder-capital/.env - Add your Ethereum mainnet & Arbitrum RPC URLs
# gateway/apollo-federation/.env - Configure federation endpoints
```

3. **Start local infrastructure**:
```bash
docker-compose -f infrastructure/docker-compose.yml up -d
```

4. **Start an indexer**:

**For Builders contracts (Arbitrum/Base)**:
```bash
cd apps/ponder-builders
npm run dev
```

**For Capital contracts (Ethereum mainnet)**:
```bash
cd apps/ponder-capital  
npm run dev
```

5. **Access APIs**:

**Builders Indexer**:
- GraphQL: http://localhost:42069/graphql
- SQL over HTTP: http://localhost:42069/sql
- Health check: http://localhost:42069/health

**Capital Indexer**:
- GraphQL: http://localhost:42070/graphql
- SQL over HTTP: http://localhost:42070/sql
- Health check: http://localhost:42070/health

## Development

Each Ponder app is independently deployable but shares common configuration:

- **Database**: PostgreSQL with schema-per-deployment pattern
- **APIs**: Auto-generated GraphQL + SQL over HTTP endpoints
- **Hot reload**: Development servers with automatic code reloading
- **Type safety**: Full TypeScript support with generated types

### Capital Indexer Features

The **ponder-capital** indexer provides complete coverage of MorpheusAI's capital staking system:

- **✅ Multi-Pool Support**: Indexes all 5 deposit pools (stETH, WBTC, WETH, USDC, USDT)
- **✅ Complete Event Coverage**: 55+ event handlers covering all user interactions
- **✅ Cross-Chain Messaging**: L1↔L2 message tracking between Ethereum and Arbitrum
- **✅ Referral System**: Full referrer/referral relationship tracking
- **✅ Proxy Contract Monitoring**: Administrative and upgrade event tracking  
- **✅ Dynamic Pool Discovery**: Factory pattern for future deposit pool additions
- **✅ Subgraph Compatibility**: 100% compatible with existing GraphQL queries
- **✅ Real-time Updates**: Live tracking of stakes, withdrawals, and reward claims

## Deployment

Production deployment uses:

- **Database views pattern**: Zero-downtime deployments with schema versioning
- **Horizontal scaling**: Multiple Ponder instances behind load balancers
- **Apollo Federation**: Single GraphQL endpoint combining all indexers
- **Monitoring**: Comprehensive logging and health checks

## Migration Strategy

The migration from existing subgraphs follows a phased approach using Apollo Federation for zero-downtime transitions:

### **🔄 Migration Phases**

1. **Phase 1**: Deploy Ponder indexers alongside existing subgraphs
2. **Phase 2**: Set up Apollo Federation combining both data sources
3. **Phase 3**: Gradually migrate queries from legacy subgraphs to Ponder
4. **Phase 4**: Decommission legacy subgraphs when migration is complete

### **⚡ Apollo Federation Query Routing**

During migration, the Apollo Gateway intelligently routes queries:

```
Frontend Query → Apollo Gateway → Decision Logic:
                                ↓
                    ┌─ ponder-builders (new data)
                    ├─ ponder-capital (new data) 
                    ├─ arbitrum-legacy (fallback)
                    ├─ base-legacy (fallback)
                    └─ capital-legacy (fallback)
```

### **🎯 Technical Implementation**

The `supergraph.yaml` configuration enables gradual migration:

```yaml
# New Ponder indexers (target endpoints)
ponder-capital:
  routing_url: http://localhost:42070/graphql

# Legacy subgraphs (safety fallback during migration)  
arbitrum-legacy:
  routing_url: https://api.studio.thegraph.com/query/73688/morpheus-mainnet-arbitrum/version/latest
capital-legacy:
  routing_url: https://api.studio.thegraph.com/query/73688/morpheus-mainnet-v-2/version/latest
```

**Query Routing Logic:**
- **New entity types** (capital deposit pools) → Always route to `ponder-capital`
- **Existing entities** → Gradually shift from legacy to Ponder based on confidence
- **Schema overlap** → Federation decides optimal routing for performance

### **🛡️ Safety Benefits**

- **✅ Zero Downtime**: Frontend applications continue working unchanged
- **✅ Instant Rollback**: Can immediately revert to legacy if issues arise
- **✅ A/B Testing**: Compare results between old and new indexers
- **✅ Data Validation**: Verify consistency during parallel operation
- **✅ Gradual Confidence**: Increase Ponder usage as reliability is proven

### **📊 Migration Monitoring**

During transition, monitor:
- Query response times for both systems
- Data consistency between legacy and Ponder
- Error rates and system health
- Gradual traffic shifting metrics

## Development Notes

### Environment Configuration
- **`.env` files are gitignored** - they contain sensitive RPC URLs and database credentials
- **Setup script creates `.env` files** automatically with template values for both indexers
- **Update RPC URLs** before starting development - default public RPCs may be rate-limited
- **Use production RPC providers** (Alchemy, Infura, QuickNode) for reliable indexing
- **Different RPC requirements**: Builders needs Arbitrum+Base, Capital needs Ethereum+Arbitrum

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
- [Capital Implementation Plan](./PONDER_CAPITAL_IMPLEMENTATION_PLAN.md)
- [Ponder Architecture Brief](./docs/Ponder%20architecture%20brief.md)
- [Complete Architecture Guide](./docs/Ponder%20Blockchain%20Indexing%20Architectur.md)
