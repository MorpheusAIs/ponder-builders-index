#!/bin/bash

# DigitalOcean Deployment Script for Ponder Monorepo
# This script automates the deployment process to DigitalOcean App Platform

set -e

# Configuration
PROJECT_NAME="morpheusai-ponder"
REPO_URL="https://github.com/BowTiedSwan/ponder-builders-index"
DO_APP_SPEC=".do/app.yaml"

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

# Check dependencies
check_dependencies() {
    print_header "Checking Dependencies"
    
    if ! command -v doctl &> /dev/null; then
        print_error "doctl CLI is not installed. Please install it first:"
        print_info "https://docs.digitalocean.com/reference/doctl/how-to/install/"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "git is not installed"
        exit 1
    fi
    
    # Check doctl authentication
    if ! doctl auth list &> /dev/null; then
        print_error "doctl is not authenticated. Run: doctl auth init"
        exit 1
    fi
    
    print_status "All dependencies are installed"
}

# Validate environment variables
validate_environment() {
    print_header "Validating Environment Variables"
    
    # Check if environment file exists
    if [ ! -f ".do/.env" ]; then
        print_warning "Environment file not found. Creating from template..."
        cp .do/env.template .do/.env
        print_error "Please edit .do/.env with your actual values before deploying"
        exit 1
    fi
    
    # Source environment variables
    source .do/.env
    
    # Check required variables
    REQUIRED_VARS=(
        "ETHEREUM_RPC_URL"
        "ARBITRUM_RPC_URL" 
        "BASE_RPC_URL"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    print_status "Environment variables validated"
}

# Create or update DigitalOcean database
setup_database() {
    print_header "Setting Up Database"
    
    # Check if database cluster exists
    DB_NAME="morpheusai-ponder-postgres"
    if doctl databases list --format Name --no-header | grep -q "$DB_NAME"; then
        print_info "Database cluster $DB_NAME already exists"
    else
        print_info "Creating PostgreSQL database cluster..."
        
        # Create database and capture the output to get the ID
        CREATE_OUTPUT=$(doctl databases create $DB_NAME \
            --engine pg \
            --version 15 \
            --size db-s-1vcpu-1gb \
            --region nyc1 \
            --num-nodes 1 \
            --format ID,Status --no-header)
        
        # Extract the database ID from the output
        DB_ID=$(echo "$CREATE_OUTPUT" | awk '{print $1}')
        print_info "Database ID: $DB_ID"
        print_status "Database cluster created successfully"
        
        # Wait for database to be ready
        print_info "Waiting for database to be ready..."
        while true; do
            STATUS=$(doctl databases get $DB_ID --format Status --no-header)
            if [ "$STATUS" = "online" ]; then
                break
            fi
            echo "Database status: $STATUS. Waiting..."
            sleep 30
        done
    fi
    
    print_status "Database setup completed"
}

# Deploy the application
deploy_app() {
    print_header "Deploying Application"
    
    # Check if app exists
    APP_NAME="morpheusai-ponder-monorepo"
    if doctl apps list --format Name --no-header | grep -q "$APP_NAME"; then
        print_info "App $APP_NAME already exists. Updating..."
        
        # Get app ID
        APP_ID=$(doctl apps list --format ID,Name --no-header | grep "$APP_NAME" | cut -d' ' -f1)
        
        # Update the app
        doctl apps update $APP_ID --spec $DO_APP_SPEC
        print_status "App updated successfully"
    else
        print_info "Creating new app..."
        doctl apps create --spec $DO_APP_SPEC
        print_status "App created successfully"
    fi
    
    # Get the new app ID for monitoring
    APP_ID=$(doctl apps list --format ID,Name --no-header | grep "$APP_NAME" | cut -d' ' -f1)
    
    print_info "Monitoring deployment progress..."
    print_info "App ID: $APP_ID"
    
    # Monitor deployment
    while true; do
        STATUS=$(doctl apps get $APP_ID --format Phase --no-header)
        print_info "Deployment status: $STATUS"
        
        if [ "$STATUS" = "ACTIVE" ]; then
            print_status "Deployment completed successfully!"
            break
        elif [ "$STATUS" = "ERROR" ]; then
            print_error "Deployment failed!"
            doctl apps logs $APP_ID
            exit 1
        fi
        
        sleep 30
    done
}

# Setup monitoring (optional)
setup_monitoring() {
    print_header "Setting Up Monitoring Stack"
    
    read -p "Do you want to deploy the monitoring stack (Prometheus/Grafana)? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Creating monitoring droplet..."
        
        # Create a droplet for monitoring
        DROPLET_NAME="$PROJECT_NAME-monitoring"
        if ! doctl compute droplet list --format Name --no-header | grep -q "$DROPLET_NAME"; then
            # Create monitoring droplet
            doctl compute droplet create $DROPLET_NAME \
                --image ubuntu-22-04-x64 \
                --size s-2vcpu-4gb \
                --region nyc1 \
                --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1) \
                --user-data-file .do/scripts/monitoring-setup.sh \
                --wait
                
            print_status "Monitoring droplet created"
            
            # Get the droplet IP
            DROPLET_IP=$(doctl compute droplet list --format Name,PublicIPv4 --no-header | grep "$DROPLET_NAME" | awk '{print $2}')
            print_info "Monitoring dashboard will be available at: http://$DROPLET_IP:3001"
            print_info "Prometheus will be available at: http://$DROPLET_IP:9090"
        else
            print_info "Monitoring droplet already exists"
        fi
    else
        print_info "Skipping monitoring setup"
    fi
}

# Display deployment information
show_deployment_info() {
    print_header "Deployment Information"
    
    APP_ID=$(doctl apps list --format ID,Name --no-header | grep "morpheusai-ponder-monorepo" | cut -d' ' -f1)
    
    if [ -n "$APP_ID" ]; then
        # Get app URLs
        print_info "Fetching app information..."
        doctl apps get $APP_ID --format Name,DefaultIngress,LiveURL
        
        print_status "Deployment completed successfully!"
        print_info "Your Ponder services are now running on DigitalOcean"
        
        echo -e "\n${GREEN}Next Steps:${NC}"
        echo "1. Verify your services are responding at the URLs above"
        echo "2. Test GraphQL endpoints: /builders/graphql and /capital/graphql" 
        echo "3. Check SQL endpoints: /builders/sql and /capital/sql"
        echo "4. Monitor logs with: doctl apps logs $APP_ID"
        echo "5. Scale services if needed with: doctl apps update $APP_ID --spec $DO_APP_SPEC"
        
        if [ -f ".do/.env" ]; then
            echo "6. Configure your DNS to point to the app URLs"
            echo "7. Set up SSL certificates for custom domains"
        fi
        
    else
        print_error "Could not find deployed app"
    fi
}

# Rollback function
rollback_deployment() {
    print_header "Rolling Back Deployment"
    
    APP_NAME="morpheusai-ponder-monorepo"
    APP_ID=$(doctl apps list --format ID,Name --no-header | grep "$APP_NAME" | cut -d' ' -f1)
    
    if [ -n "$APP_ID" ]; then
        print_warning "Rolling back to previous deployment..."
        
        # Get deployment history
        doctl apps list-deployments $APP_ID --format ID,Phase,CreatedAt
        
        read -p "Enter the deployment ID to rollback to: " DEPLOYMENT_ID
        
        if [ -n "$DEPLOYMENT_ID" ]; then
            print_info "Rolling back to deployment $DEPLOYMENT_ID..."
            # Note: DigitalOcean App Platform doesn't have direct rollback,
            # but you can redeploy from a specific git commit
            print_warning "Please redeploy from the desired git commit manually"
        fi
    else
        print_error "No app found to rollback"
    fi
}

# Main function
main() {
    print_header "DigitalOcean Deployment for Ponder MorpheusAI"
    
    case "${1:-deploy}" in
        "deploy")
            check_dependencies
            validate_environment
            setup_database
            deploy_app
            setup_monitoring
            show_deployment_info
            ;;
        "rollback")
            check_dependencies
            rollback_deployment
            ;;
        "status")
            check_dependencies
            show_deployment_info
            ;;
        "logs")
            check_dependencies
            APP_ID=$(doctl apps list --format ID,Name --no-header | grep "morpheusai-ponder-monorepo" | cut -d' ' -f1)
            if [ -n "$APP_ID" ]; then
                doctl apps logs $APP_ID --follow
            else
                print_error "App not found"
            fi
            ;;
        *)
            echo "Usage: $0 [deploy|rollback|status|logs]"
            echo ""
            echo "Commands:"
            echo "  deploy   - Deploy the application (default)"
            echo "  rollback - Rollback to previous deployment"
            echo "  status   - Show deployment status and URLs"  
            echo "  logs     - Follow application logs"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
