#!/bin/bash

# DigitalOcean App Platform Deployment Script
# This script deploys the Ponder monorepo with multiple indexes to DigitalOcean

set -e

echo "🚀 Deploying Ponder Monorepo to DigitalOcean App Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo -e "${RED}❌ doctl CLI is not installed. Please install it first:${NC}"
    echo "   https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

# Check if authenticated
if ! doctl auth list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with DigitalOcean. Please run:${NC}"
    echo "   doctl auth init"
    exit 1
fi

# Validate required environment variables
required_vars=(
    "PONDER_RPC_URL_1"
    "PONDER_RPC_URL_42161"
    "PONDER_RPC_URL_8453"
    "PONDER_RPC_URL_84532"
)

echo -e "${YELLOW}📋 Checking required environment variables...${NC}"
missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please set these variables before deploying:"
    echo "   export PONDER_RPC_URL_1=https://..."
    echo "   export PONDER_RPC_URL_42161=https://..."
    echo "   export PONDER_RPC_URL_8453=https://..."
    echo "   export PONDER_RPC_URL_84532=https://..."
    exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}"

# Check if app.yaml exists
if [ ! -f ".do/app.yaml" ]; then
    echo -e "${RED}❌ .do/app.yaml not found. Please create the configuration file first.${NC}"
    exit 1
fi

# Get the app ID if it exists
APP_NAME="ponder-builders-index-monorepo"
APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep "$APP_NAME" | awk '{print $1}' | head -n 1)

if [ -z "$APP_ID" ]; then
    echo -e "${YELLOW}📦 Creating new DigitalOcean App...${NC}"
    
    # Create the app
    APP_ID=$(doctl apps create --spec .do/app.yaml --format ID --no-header)
    
    if [ -z "$APP_ID" ]; then
        echo -e "${RED}❌ Failed to create app${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ App created with ID: $APP_ID${NC}"
    
    # Set environment variables
    echo -e "${YELLOW}🔐 Setting environment variables...${NC}"
    doctl apps update "$APP_ID" --spec .do/app.yaml
    
    echo -e "${GREEN}✅ Deployment initiated!${NC}"
    echo ""
    echo "Monitor deployment status with:"
    echo "   doctl apps get-deployment $APP_ID"
    echo ""
    echo "View app details:"
    echo "   doctl apps get $APP_ID"
else
    echo -e "${YELLOW}📦 Updating existing DigitalOcean App (ID: $APP_ID)...${NC}"
    
    # Update the app
    doctl apps update "$APP_ID" --spec .do/app.yaml
    
    echo -e "${GREEN}✅ App update initiated!${NC}"
    echo ""
    echo "Monitor deployment status with:"
    echo "   doctl apps get-deployment $APP_ID"
fi

echo ""
echo -e "${GREEN}🎉 Deployment process started!${NC}"
echo ""
echo "Next steps:"
echo "1. Monitor the deployment in the DigitalOcean dashboard"
echo "2. Check logs: doctl apps logs $APP_ID --type run"
echo "3. Verify health checks: curl https://your-app-url/capital/health"
echo ""
echo "Services deployed:"
echo "  - ponder-capital (Capital indexer)"
echo "  - ponder-builders (Builders indexer)"
echo "  - ponder-builders-v4 (Builders V4 indexer on Base Sepolia)"

