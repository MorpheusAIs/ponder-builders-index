#!/bin/bash

# Zero-Downtime Deployment Script using Database Views Pattern
# This script implements the blue-green deployment strategy recommended in Ponder documentation

set -e

# Configuration
PROJECT_NAME=${1:-"ponder-builders"}
DEPLOYMENT_ID=${2:-$(date +%Y%m%d_%H%M%S)}
DATABASE_URL=${DATABASE_URL:-"postgresql://ponder:ponder_dev_password@localhost:5432/ponder_builders"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Validate inputs
if [ -z "$PROJECT_NAME" ]; then
    print_error "Project name is required"
    exit 1
fi

print_header "Zero-Downtime Deployment for $PROJECT_NAME"
print_info "Deployment ID: $DEPLOYMENT_ID"
print_info "Database URL: $DATABASE_URL"

# Step 1: Create new schema for this deployment
print_header "Step 1: Creating new database schema"

SCHEMA_NAME="ponder_${DEPLOYMENT_ID}"
print_info "Creating schema: $SCHEMA_NAME"

psql "$DATABASE_URL" -c "CREATE SCHEMA IF NOT EXISTS $SCHEMA_NAME;"
print_status "Created schema $SCHEMA_NAME"

# Step 2: Start Ponder with new schema
print_header "Step 2: Starting Ponder indexing in new schema"

cd "apps/$PROJECT_NAME"

# Set environment variables for the new deployment
export PONDER_SCHEMA_NAME=$SCHEMA_NAME
export PONDER_DATABASE_SCHEMA=$SCHEMA_NAME

print_info "Starting Ponder with schema: $SCHEMA_NAME"
print_info "This will perform historical sync in isolation..."

# Start Ponder in background with new schema
pnpm start --schema $SCHEMA_NAME &
PONDER_PID=$!

print_info "Ponder started with PID: $PONDER_PID"

# Step 3: Monitor sync progress
print_header "Step 3: Monitoring sync progress"

print_info "Waiting for historical sync to complete..."
print_warning "This may take several minutes depending on the chain history..."

# Function to check sync status
check_sync_status() {
    local response=$(curl -s "http://localhost:42069/status" 2>/dev/null || echo '{"status":"error"}')
    echo "$response" | grep -o '"status":"ready"' > /dev/null 2>&1
}

# Wait for sync completion with timeout
TIMEOUT=3600  # 1 hour timeout
ELAPSED=0
INTERVAL=30

while [ $ELAPSED -lt $TIMEOUT ]; do
    if check_sync_status; then
        print_status "Historical sync completed!"
        break
    fi
    
    print_info "Sync in progress... (${ELAPSED}s elapsed)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    print_error "Sync timeout reached. Please check Ponder logs."
    kill $PONDER_PID 2>/dev/null || true
    exit 1
fi

# Step 4: Create/update views to point to new schema
print_header "Step 4: Updating database views"

print_info "Creating views in public schema pointing to $SCHEMA_NAME..."

# Get all tables from the new schema
TABLES=$(psql "$DATABASE_URL" -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = '$SCHEMA_NAME' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
")

# Create or replace views for each table
for table in $TABLES; do
    table=$(echo $table | xargs) # trim whitespace
    if [ ! -z "$table" ]; then
        print_info "Creating view for table: $table"
        psql "$DATABASE_URL" -c "
            CREATE OR REPLACE VIEW public.$table AS 
            SELECT * FROM $SCHEMA_NAME.$table;
        "
    fi
done

print_status "All views updated to point to $SCHEMA_NAME"

# Step 5: Verify new deployment
print_header "Step 5: Verifying new deployment"

print_info "Testing GraphQL endpoint..."
if curl -s -X POST -H "Content-Type: application/json" \
   -d '{"query":"query { __schema { types { name } } }"}' \
   "http://localhost:42069/graphql" > /dev/null; then
    print_status "GraphQL endpoint is responding"
else
    print_error "GraphQL endpoint is not responding"
fi

print_info "Testing SQL endpoint..."
if curl -s "http://localhost:42069/sql" > /dev/null; then
    print_status "SQL endpoint is responding"
else
    print_error "SQL endpoint is not responding"
fi

# Step 6: Cleanup old schemas (keep last 3 deployments)
print_header "Step 6: Cleanup old schemas"

print_info "Cleaning up old deployment schemas (keeping last 3)..."

OLD_SCHEMAS=$(psql "$DATABASE_URL" -t -c "
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE 'ponder_%' 
AND schema_name != '$SCHEMA_NAME'
ORDER BY schema_name DESC
OFFSET 2;
")

for schema in $OLD_SCHEMAS; do
    schema=$(echo $schema | xargs) # trim whitespace
    if [ ! -z "$schema" ]; then
        print_info "Dropping old schema: $schema"
        psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS $schema CASCADE;"
    fi
done

print_status "Cleanup completed"

# Step 7: Final status report
print_header "Deployment Complete!"

echo -e "\n📊 ${GREEN}Deployment Summary${NC}"
echo "==================="
echo "Project: $PROJECT_NAME"
echo "Deployment ID: $DEPLOYMENT_ID"
echo "Active Schema: $SCHEMA_NAME"
echo "Ponder PID: $PONDER_PID"
echo ""
echo "🔗 Endpoints:"
echo "  GraphQL: http://localhost:42069/graphql"
echo "  SQL API: http://localhost:42069/sql"
echo "  Health:  http://localhost:42069/health"
echo ""
echo "📝 Next Steps:"
echo "1. Test the endpoints thoroughly"
echo "2. Update your frontend to use the new API if needed"
echo "3. Monitor performance and error rates"
echo "4. The previous deployment remains in the database for rollback if needed"

print_warning "Keep this terminal open to monitor the Ponder process, or use 'kill $PONDER_PID' to stop it"
