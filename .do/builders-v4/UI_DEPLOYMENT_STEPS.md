# Step-by-Step UI Deployment Guide

## Creating Builders V4 App in DigitalOcean UI

Since there's no "Import YAML" option, follow these steps to create the app manually:

### Step 1: Create New App
1. Go to DigitalOcean Dashboard → **Apps** → **Create App**
2. Choose **"GitHub"** as your source
3. **Connect GitHub** (if not already connected)
4. Select repository: `MorpheusAIs/ponder-builders-index` (or your fork)
5. Select branch: `main`
6. Click **"Next"**

### Step 2: Configure Service
1. You should see "Detected Services" or "Add Component"
2. If it auto-detects services, **remove/delete** any auto-detected ones
3. Click **"Add Component"** → **"Service"**

### Step 3: Configure Build Settings
1. **Name**: `builders-v4`
2. **Source Directory**: `.` (root of repo - leave default or enter `.`)
3. **Build Strategy**: Select **"Dockerfile"** (NOT Buildpack!)
   - If you don't see this option, look for "Build method" or "Build type"
   - You may need to click "Edit" on the build section
4. **Dockerfile Path**: `apps/ponder-builders-v4-base-sepolia/Dockerfile.production`
5. **Build Command**: Leave empty (Dockerfile handles this)
6. **Run Command**: Leave empty (Dockerfile CMD handles this)

### Step 4: Configure Resources
1. **Instance Size**: `Basic XXS` (or smallest available)
2. **Instance Count**: `1`
3. **HTTP Port**: `42069`

### Step 5: Add Database
1. Click **"Add Component"** → **"Database"**
2. Choose **"Create new database"** OR **"Use existing database"**
3. If creating new:
   - **Name**: `builders-v4-db`
   - **Engine**: PostgreSQL
   - **Version**: 15
   - **Plan**: Development (smallest)
4. If using existing:
   - Select `builders-v4-db` from dropdown

### Step 6: Configure Environment Variables
Click **"Edit"** on Environment Variables section and add:

**Required:**
- `DATABASE_URL` = `${builders-v4-db.DATABASE_URL}` (auto-populated if database component is linked)
- `DATABASE_SCHEMA` = `${APP_DEPLOYMENT_ID}`
- `PONDER_RPC_URL_84532` = (your Base Sepolia RPC URL - set as SECRET)

**Optional:**
- `PONDER_LOG_LEVEL` = `info`
- Contract addresses (if you want to override defaults)

### Step 7: Configure Health Check
1. **HTTP Path**: `/health`
2. **Initial Delay**: `120` seconds
3. **Period**: `30` seconds
4. **Timeout**: `15` seconds

### Step 8: Review and Deploy
1. Review all settings
2. Click **"Create Resources"** or **"Deploy"**

## Troubleshooting

**If you can't find "Dockerfile" option:**
- The UI might be auto-detecting Buildpack
- Try clicking "Edit" on the build/deployment section
- Look for "Build method" dropdown
- If still not available, you may need to use doctl after fixing GitHub access

**If GitHub access error:**
- Go to DigitalOcean Settings → Integrations → GitHub
- Reconnect/authorize GitHub account that has access to the repo
- Or use a fork you have access to

