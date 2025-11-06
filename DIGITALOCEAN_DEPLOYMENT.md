# DigitalOcean App Platform Deployment Guide

This guide explains how to deploy the Ponder monorepo with multiple indexes (capital, builders, builders-v4) to DigitalOcean App Platform.

## Prerequisites

1. **DigitalOcean Account**: Sign up at https://www.digitalocean.com
2. **doctl CLI**: Install the DigitalOcean CLI tool
   ```bash
   # macOS
   brew install doctl
   
   # Linux
   wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
   tar xf doctl-1.104.0-linux-amd64.tar.gz
   sudo mv doctl /usr/local/bin
   ```

3. **Authentication**: Authenticate with DigitalOcean
   ```bash
   doctl auth init
   ```

4. **Environment Variables**: Set up your RPC URLs
   ```bash
   export PONDER_RPC_URL_1="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
   export PONDER_RPC_URL_42161="https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY"
   export PONDER_RPC_URL_8453="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
   export PONDER_RPC_URL_84532="https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
   ```

## Architecture Overview

The deployment consists of:

1. **PostgreSQL Database**: Shared database for all three indexers
2. **ponder-capital**: Indexes Capital contracts on Ethereum mainnet and Arbitrum
3. **ponder-builders**: Indexes Builders contracts on Arbitrum and Base
4. **ponder-builders-v4**: Indexes Builders V4 contracts on Base Sepolia

Each service uses:
- Separate database schemas for isolation
- Health check endpoints at `/health` and `/ready`
- GraphQL API at `/graphql`
- SQL over HTTP at `/sql/*`

## Deployment Methods

### Method 1: Using doctl CLI (Recommended)

1. **Deploy using the script**:
   ```bash
   ./scripts/deploy-digitalocean.sh
   ```

2. **Or deploy manually**:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```

3. **Set environment variables** (if not using the script):
   ```bash
   APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep "ponder-builders-index-monorepo" | awk '{print $1}')
   
   # Set RPC URLs as secrets
   doctl apps update $APP_ID --spec .do/app.yaml
   ```

### Method 2: Using DigitalOcean Dashboard

1. Go to https://cloud.digitalocean.com/apps
2. Click "Create App"
3. Connect your GitHub repository: `MorpheusAIs/ponder-builders-index`
4. Select the branch: `main`
5. DigitalOcean will auto-detect the `.do/app.yaml` file
6. Review the configuration
7. Add environment variables:
   - `PONDER_RPC_URL_1` (Secret)
   - `PONDER_RPC_URL_42161` (Secret)
   - `PONDER_RPC_URL_8453` (Secret)
   - `PONDER_RPC_URL_84532` (Secret)
8. Click "Create Resources"

### Method 3: Using DigitalOcean MCP Server

If you have the DigitalOcean MCP server configured, you can deploy programmatically:

```typescript
// The MCP server requires a full JSON spec
// See the deployment script for the complete spec structure
```

## Configuration Details

### Database Schema Isolation

Each service uses a separate database schema:
- `ponder_capital_prod` - Capital indexer
- `ponder_builders_prod` - Builders indexer  
- `ponder_builders_v4_prod` - Builders V4 indexer

This enables:
- Zero-downtime deployments
- Independent scaling
- Data isolation

### Health Checks

Each service exposes:
- `/health` - Basic health check (returns 200 if healthy)
- `/ready` - Readiness check (verifies database connectivity)

Health check configuration:
- Initial delay: 120 seconds (allows time for initial sync)
- Period: 30 seconds
- Timeout: 15 seconds
- Success threshold: 1
- Failure threshold: 3

### Resource Allocation

Each service is configured with:
- Instance size: `basic-xxs` (0.5 vCPU, 0.5 GB RAM)
- Instance count: 1 (can be scaled up)
- HTTP port: 42069

For production workloads, consider:
- `basic-xs` (1 vCPU, 1 GB RAM) for moderate load
- `basic-s` (1 vCPU, 2 GB RAM) for high load
- `professional-xs` (2 vCPU, 4 GB RAM) for very high load

### RPC Configuration

Each service uses load-balanced RPC endpoints with fallbacks:
- Primary: Environment variable (your Alchemy/Infura key)
- Fallback: Public RPC endpoints with rate limiting

This ensures reliability even if your primary RPC provider has issues.

## Monitoring and Logs

### View Logs

```bash
# Get app ID
APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep "ponder-builders-index-monorepo" | awk '{print $1}')

# View logs
doctl apps logs $APP_ID --type run
doctl apps logs $APP_ID --type build
doctl apps logs $APP_ID --component ponder-capital
doctl apps logs $APP_ID --component ponder-builders
doctl apps logs $APP_ID --component ponder-builders-v4
```

### Check Deployment Status

```bash
doctl apps get-deployment $APP_ID
```

### Monitor Health

```bash
# After deployment, get the app URL
APP_URL=$(doctl apps get $APP_ID --format Spec.Services[0].Routes[0].Path --no-header)

# Check health
curl https://$APP_URL/capital/health
curl https://$APP_URL/builders/health
curl https://$APP_URL/builders-v4/health
```

## Updating the Deployment

### Update Configuration

1. Edit `.do/app.yaml`
2. Apply changes:
   ```bash
   APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep "ponder-builders-index-monorepo" | awk '{print $1}')
   doctl apps update $APP_ID --spec .do/app.yaml
   ```

### Update Environment Variables

```bash
# Update via dashboard or doctl
doctl apps update $APP_ID --spec .do/app.yaml
```

## Troubleshooting

### Service Not Starting

1. Check logs:
   ```bash
   doctl apps logs $APP_ID --component <service-name> --type run
   ```

2. Verify environment variables are set correctly
3. Check database connectivity
4. Verify RPC URLs are accessible

### Health Checks Failing

1. Check if the service is actually running:
   ```bash
   doctl apps get $APP_ID
   ```

2. Verify database schema exists and is accessible
3. Check if the health endpoint is responding:
   ```bash
   curl https://<app-url>/<service>/health
   ```

### Database Connection Issues

1. Verify `DATABASE_URL` is correctly set
2. Check database firewall rules
3. Verify database schema exists:
   ```sql
   SELECT schema_name FROM information_schema.schemata 
   WHERE schema_name LIKE 'ponder_%';
   ```

### RPC Rate Limiting

If you see RPC errors:
1. Check your RPC provider dashboard for rate limits
2. Consider upgrading your RPC plan
3. Verify fallback RPCs are working
4. Check logs for specific RPC errors

## Scaling

### Horizontal Scaling

Increase instance count:
```yaml
instance_count: 2  # or more
```

### Vertical Scaling

Upgrade instance size:
```yaml
instance_size_slug: basic-xs  # or professional-xs
```

### Database Scaling

Upgrade database size in the DigitalOcean dashboard or via doctl.

## Cost Estimation

Approximate monthly costs (as of 2024):
- Database (db-s-dev-database): ~$15/month
- 3x Services (basic-xxs): ~$5/month each = $15/month
- **Total**: ~$30/month

For production:
- Database (db-s-1vcpu-1gb): ~$25/month
- 3x Services (basic-xs): ~$12/month each = $36/month
- **Total**: ~$61/month

## Best Practices

1. **Use separate schemas** for each deployment to enable zero-downtime updates
2. **Monitor RPC usage** to avoid rate limits
3. **Set up alerts** for deployment failures and high error rates
4. **Use database connection pooling** (already configured in Ponder)
5. **Enable backups** for the production database
6. **Use secrets** for all sensitive environment variables
7. **Monitor costs** regularly
8. **Test deployments** in a staging environment first

## Next Steps

1. Set up custom domains for each service
2. Configure CDN for GraphQL endpoints
3. Set up monitoring and alerting
4. Implement automated backups
5. Set up CI/CD pipeline for automated deployments

## Support

For issues or questions:
- Check Ponder documentation: https://ponder.sh/docs
- DigitalOcean App Platform docs: https://docs.digitalocean.com/products/app-platform/
- Open an issue in the repository

