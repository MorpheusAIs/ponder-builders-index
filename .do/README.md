# DigitalOcean Deployment for Ponder MorpheusAI

This directory contains all the configuration files and scripts needed to deploy your Ponder monorepo to DigitalOcean App Platform with comprehensive monitoring.

## 📁 Directory Structure

```
.do/
├── app.yaml                           # DigitalOcean App Platform configuration
├── env.template                       # Environment variables template
├── README.md                          # This file
├── monitoring/                        # Complete monitoring stack
│   ├── docker-compose.monitoring.yml  # Main monitoring services
│   ├── docker-compose.postgres-exporter.yml # PostgreSQL monitoring
│   ├── prometheus/
│   │   ├── prometheus.yml             # Prometheus configuration
│   │   └── rules/ponder.yml          # Alerting rules for Ponder
│   ├── grafana/
│   │   ├── provisioning/             # Auto-provisioning configs
│   │   └── dashboards/               # Pre-built dashboards
│   ├── alertmanager/
│   │   └── alertmanager.yml          # Alert routing configuration
│   └── postgres-exporter/
│       └── queries.yaml              # Custom PostgreSQL metrics
└── scripts/
    ├── deploy.sh                     # Main deployment script
    └── monitoring-setup.sh           # Monitoring droplet setup
```

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install DigitalOcean CLI
# macOS
brew install doctl

# Ubuntu/Debian
snap install doctl

# Authenticate with DigitalOcean
doctl auth init
```

### 2. Environment Setup

```bash
# Copy and edit environment variables
cp .do/env.template .do/.env
# Edit .do/.env with your actual values
```

### 3. Deploy to DigitalOcean

```bash
# Make deployment script executable
chmod +x .do/scripts/deploy.sh

# Deploy everything
./.do/scripts/deploy.sh deploy
```

## ⚙️ Configuration Details

### App Platform Configuration (`app.yaml`)

Your Ponder monorepo is configured with:

- **ponder-builders**: Arbitrum & Base blockchain indexing
- **ponder-capital**: Ethereum mainnet & Arbitrum capital flows  
- **apollo-gateway**: GraphQL federation layer
- **ponder-sql-api**: Read-only SQL access
- **PostgreSQL Database**: Managed database with automatic backups

### Environment Variables (`.env`)

Required configuration:
```bash
# RPC Endpoints
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Optional: Monitoring
GRAFANA_ADMIN_PASSWORD=your_secure_password
```

## 📊 Monitoring Stack

### What's Included

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization dashboards  
- **AlertManager**: Alert routing and notifications
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics
- **PostgreSQL Exporter**: Database metrics

### Access Monitoring

After deployment:
```bash
# Get monitoring URLs
./.do/scripts/deploy.sh status
```

Default access:
- **Grafana**: `http://your-monitoring-ip:3001` (admin / ponder_monitor_2024)
- **Prometheus**: `http://your-monitoring-ip:9090`

### Pre-built Dashboards

1. **Ponder Overview**: Service health, performance, and indexing progress
2. **Database Monitoring**: PostgreSQL performance and schema metrics
3. **System Metrics**: CPU, memory, disk, and network monitoring
4. **Container Metrics**: Docker container resource usage

### Alert Rules

Configured alerts for:
- Service downtime
- High resource usage  
- Database connection issues
- RPC endpoint failures
- Indexing lag
- Chain reorganizations

## 💰 Cost Analysis

### DigitalOcean App Platform Costs

**Production Setup:**
- **ponder-builders**: Professional-XS ($12/month)
- **ponder-capital**: Professional-XS ($12/month)  
- **apollo-gateway**: Basic-XXS ($5/month)
- **ponder-sql-api**: Basic-XXS ($5/month)
- **PostgreSQL**: Production DB-S-1vCPU-1GB ($15/month)

**Total App Platform**: ~$49/month

### Monitoring Infrastructure (Optional)

- **Monitoring Droplet**: 2vCPU, 4GB RAM ($24/month)
- **Load Balancer** (if needed): $12/month

**Total with Monitoring**: ~$85/month

### Cost Optimization Tips

1. **Start Small**: Begin with basic tier apps and scale up
2. **Monitor Usage**: Use Grafana to identify optimization opportunities
3. **Database Retention**: Configure appropriate retention policies
4. **Auto-scaling**: Enable horizontal scaling for high-traffic periods

## 🔧 Deployment Commands

```bash
# Deploy application
./.do/scripts/deploy.sh deploy

# Check deployment status  
./.do/scripts/deploy.sh status

# View application logs
./.do/scripts/deploy.sh logs

# Rollback deployment
./.do/scripts/deploy.sh rollback
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Apollo        │    │   ponder-        │    │   ponder-       │
│   Gateway       │◄──►│   builders       │    │   capital       │
│   Port: 4000    │    │   Port: 42069    │    │   Port: 42069   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │   Managed DB     │
                    └──────────────────┘
                                 │
                    ┌──────────────────┐
                    │   Monitoring     │
                    │   Stack          │
                    │   (Optional)     │
                    └──────────────────┘
```

## 🔒 Security Features

- **Database Views Pattern**: Zero-downtime deployments
- **Environment Variable Secrets**: Secure configuration management  
- **Network Isolation**: Private networking between services
- **Health Checks**: Automatic service recovery
- **SSL/HTTPS**: Automatic certificate management
- **Access Control**: Role-based permissions in Grafana

## 🛠️ Maintenance

### Database Management

```bash
# Access database directly (if needed)
doctl databases connection your-db-id

# Create database backups
doctl databases backup create your-db-id

# Monitor database performance  
# Use the PostgreSQL dashboard in Grafana
```

### Scaling Services

Update `.do/app.yaml` and redeploy:
```yaml
instance_count: 2              # Horizontal scaling
instance_size_slug: professional-s  # Vertical scaling
```

### Log Management

```bash
# View real-time logs
./.do/scripts/deploy.sh logs

# Download logs for analysis
doctl apps logs your-app-id --output logs.txt
```

## 🆘 Troubleshooting

### Common Issues

1. **RPC Rate Limits**: Upgrade to paid RPC providers (Alchemy, Infura)
2. **Memory Issues**: Increase instance size or add horizontal scaling
3. **Database Connections**: Monitor connection pools in Grafana
4. **Build Failures**: Check environment variables and dependencies

### Getting Help

- **DigitalOcean Docs**: [App Platform Documentation](https://docs.digitalocean.com/products/app-platform/)
- **Ponder Docs**: [Self-hosting Guide](https://ponder.sh/docs/production/self-hosting)
- **Community**: [Ponder Discord](https://discord.gg/ponder) | [DigitalOcean Community](https://www.digitalocean.com/community/)

### Health Checks

All services include comprehensive health checks:
- `/health`: Basic service health
- `/ready`: Service ready to handle requests  
- `/metrics`: Prometheus metrics endpoint

---

## 🎯 Next Steps After Deployment

1. ✅ Verify all services are running
2. ✅ Test GraphQL and SQL endpoints
3. ✅ Configure custom domain (optional)
4. ✅ Set up monitoring alerts
5. ✅ Monitor indexing progress
6. ✅ Performance optimization based on metrics

Your Ponder MorpheusAI blockchain indexers are now running on DigitalOcean with enterprise-grade monitoring! 🚀



