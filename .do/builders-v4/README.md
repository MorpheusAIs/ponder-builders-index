# Builders V4 DigitalOcean App Platform Deployment

This directory contains the DigitalOcean App Platform configuration for deploying the Builders V4 indexer as a standalone application.

## Files

- `app.yaml` - DigitalOcean App Platform specification file

## Configuration Overview

### App Details
- **Name**: `builders-v4-index`
- **Region**: `nyc1` (New York)
- **Service**: Single service running the Builders V4 Base Sepolia indexer

### Database
- **Type**: PostgreSQL 15
- **Name**: `builders-v4-db` (referenced as `${builders-v4-db.DATABASE_URL}`)
- **Size**: `db-s-dev-database` (development size, change to production size for prod)
- **Production**: `false` (set to `true` for production deployment)

**Note**: If you already have a database named `builders-v4-db` on DigitalOcean, App Platform will link to it. If it doesn't exist, App Platform will create it.

### Service Configuration
- **Dockerfile**: `apps/ponder-builders-v4-base-sepolia/Dockerfile.production`
- **Source Directory**: `.` (root of monorepo)
- **HTTP Port**: `42069`
- **Instance Size**: `basic-xxs` (smallest, scale up as needed)
- **Instance Count**: `1`

### Environment Variables

#### Required (Set in DigitalOcean Dashboard)
- `PONDER_RPC_URL_84532` - Base Sepolia RPC endpoint URL (SECRET type)

#### Auto-configured
- `DATABASE_URL` - Automatically populated from database component (`${builders-v4-db.DATABASE_URL}`)
- `DATABASE_SCHEMA` - Uses `${APP_DEPLOYMENT_ID}` for zero-downtime deployments

#### Optional (with defaults)
- `PONDER_LOG_LEVEL` - Default: `info`
- Contract addresses and start blocks (defaults in `ponder.config.ts`)

### Health Checks
- **Path**: `/health`
- **Initial Delay**: 120 seconds (allows time for indexing to start)
- **Period**: 30 seconds
- **Timeout**: 15 seconds
- **Success Threshold**: 1
- **Failure Threshold**: 3

## Deployment Instructions

### Option 1: Using doctl CLI

```bash
# Install doctl if not already installed
# https://docs.digitalocean.com/reference/doctl/how-to/install/

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/builders-v4/app.yaml
```

### Option 2: Using DigitalOcean Dashboard

1. Go to DigitalOcean Dashboard → Apps → Create App
2. Choose "GitHub" as source
3. Select repository: `MorpheusAIs/ponder-builders-index`
4. Branch: `main`
5. Configure:
   - Source directory: `.` (root)
   - Dockerfile path: `apps/ponder-builders-v4-base-sepolia/Dockerfile.production`
6. Add PostgreSQL database component
7. Set environment variables (especially `PONDER_RPC_URL_84532`)
8. Configure health check: `/health` on port `42069`
9. Deploy

### Option 3: Import app.yaml

1. Go to DigitalOcean Dashboard → Apps → Create App
2. Choose "Import from YAML"
3. Paste contents of `.do/builders-v4/app.yaml`
4. Update environment variables (especially `PONDER_RPC_URL_84532`)
5. Deploy

## Important Notes

1. **RPC Endpoint**: You MUST set `PONDER_RPC_URL_84532` as a SECRET environment variable in DigitalOcean. Use a paid RPC provider (Alchemy, Infura, QuickNode) for production.

2. **Database Schema**: The app uses `${APP_DEPLOYMENT_ID}` as the database schema, enabling zero-downtime deployments. Each deployment gets its own schema.

3. **Views Schema**: Database views are automatically created in the `builders_v4` schema (configured in Dockerfile CMD).

4. **Health Endpoints**: 
   - `/health` - Returns 200 immediately after process starts
   - `/ready` - Returns 200 when indexing is caught up, 503 during backfill

5. **Scaling**: Start with `basic-xxs` and scale up (`basic-xs`, `basic-s`, etc.) based on indexing load and traffic.

6. **Production**: For production deployment:
   - Set `production: true` in database configuration
   - Choose appropriate database size
   - Use production-grade RPC endpoints
   - Consider increasing instance size

## Monitoring

After deployment, monitor:
- App Platform logs for indexing progress
- Database connection status
- Health check status
- Resource usage (CPU, memory)

## Troubleshooting

- **Build fails**: Check Dockerfile path and source directory
- **Database connection fails**: Verify `DATABASE_URL` is set correctly and database is accessible
- **Indexing not starting**: Check RPC endpoint is valid and accessible
- **Health check fails**: Check logs for errors, verify port 42069 is exposed

