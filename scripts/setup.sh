#!/bin/bash

# MorpheusAI Ponder Monorepo Setup Script
# This script initializes the development environment

set -e

echo "🚀 Setting up MorpheusAI Ponder Indexing Monorepo..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if ! node -e "process.exit(process.version.localeCompare('v$REQUIRED_VERSION', undefined, { numeric: true }) >= 0 ? 0 : 1)"; then
    print_error "Node.js version $REQUIRED_VERSION or higher is required. Current version: $NODE_VERSION"
    exit 1
fi

print_status "Node.js version $NODE_VERSION is compatible"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

print_status "pnpm is available"

# Install dependencies
print_status "Installing dependencies..."
pnpm install

# Build shared packages
print_status "Building shared packages..."
cd packages/shared-abis
pnpm build
cd ../..

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_warning "Docker is not installed. You'll need Docker to run the local database."
    print_warning "Please install Docker and run: docker-compose -f infrastructure/docker-compose.yml up -d"
else
    print_status "Docker is available"
    
    # Start local infrastructure
    print_status "Starting local PostgreSQL database..."
    docker-compose -f infrastructure/docker-compose.yml up -d postgres
    
    # Wait for PostgreSQL to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 10
fi

# Create environment files from examples
if [ ! -f "apps/ponder-builders/.env" ]; then
    cat > apps/ponder-builders/.env << EOF
# Database Configuration
DATABASE_URL=postgresql://ponder:ponder_dev_password@localhost:5432/ponder_builders

# RPC Endpoints - REPLACE WITH YOUR OWN RPCS
PONDER_RPC_URL_42161=https://arb1.arbitrum.io/rpc
PONDER_RPC_URL_8453=https://mainnet.base.org

# Ponder Configuration
PONDER_LOG_LEVEL=info
PONDER_PORT=42069

# Development
NODE_ENV=development
EOF
    print_status "Created apps/ponder-builders/.env file"
    print_warning "Please update the RPC URLs in apps/ponder-builders/.env with your own endpoints"
else
    print_status "Environment file already exists"
fi

# Create federation environment
if [ ! -f "gateway/apollo-federation/.env" ]; then
    cat > gateway/apollo-federation/.env << EOF
# Apollo Federation Configuration
PORT=4000
NODE_ENV=development

# Service URLs
PONDER_BUILDERS_URL=http://localhost:42069/graphql
ARBITRUM_SUBGRAPH_URL=https://api.studio.thegraph.com/query/73688/morpheus-mainnet-arbitrum/version/latest
BASE_SUBGRAPH_URL=https://subgraph.satsuma-prod.com/8675f21b07ed/9iqb9f4qcmhosiruyg763--465704/morpheus-mainnet-base/api
EOF
    print_status "Created gateway/apollo-federation/.env file"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update RPC URLs in apps/ponder-builders/.env"
echo "2. Start the builders indexer: cd apps/ponder-builders && pnpm dev"
echo "3. (Optional) Start the federation gateway: cd gateway/apollo-federation && pnpm dev"
echo ""
echo "📊 URLs when running:"
echo "- Builders GraphQL: http://localhost:42069/graphql"
echo "- Builders SQL API: http://localhost:42069/sql"
echo "- Federation Gateway: http://localhost:4000/graphql"
echo "- PostgreSQL: postgresql://ponder:ponder_dev_password@localhost:5432/ponder_builders"
echo ""
print_warning "Remember to replace the RPC URLs with your own Alchemy/Infura/QuickNode endpoints for better reliability"
