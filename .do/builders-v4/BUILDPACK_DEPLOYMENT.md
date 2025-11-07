# Using Buildpacks Instead of Docker

You're absolutely right! **We don't need Docker.** Ponder is just a Node.js app, and DigitalOcean's buildpacks work perfectly fine.

## Why Buildpacks?

- ✅ **Simpler** - No Dockerfile to maintain
- ✅ **Faster builds** - No Docker image layers
- ✅ **Auto-detection** - Buildpack detects Node.js + pnpm automatically
- ✅ **Matches Ponder docs** - Just a Node.js app with `pnpm start`

## The Fix

The issue is that DigitalOcean detected buildpacks (which is fine!), but the build is failing because:

1. **Buildpack auto-installs dependencies** at the root (monorepo)
2. **We need to build shared packages** (`@morpheusai/shared-abis`)
3. **We need to run from the app directory** (`apps/ponder-builders-v4-base-sepolia`)

## Solution: Use `app-buildpack.yaml`

I've created `app-buildpack.yaml` which:
- Removes `dockerfile_path` (lets buildpack handle it)
- Sets `build_command` to build shared packages
- Sets `run_command` to run Ponder from the app directory

## Update Your App

### Option 1: Update via doctl (Recommended)

```bash
# Get your app ID
doctl apps list

# Update with buildpack-based spec
doctl apps update <APP_ID> --spec .do/builders-v4/app-buildpack.yaml
```

### Option 2: Update in UI

1. Go to **Apps** → **builders-v4-index** → **Settings** → **Components**
2. Edit the **builders-v4** service
3. **Remove Dockerfile Path** (if set)
4. **Set Build Command**:
   ```
   pnpm --filter @morpheusai/shared-abis build
   ```
5. **Set Run Command**:
   ```
   cd apps/ponder-builders-v4-base-sepolia && pnpm start --schema ${DATABASE_SCHEMA:-builders_v4_prod} --views-schema builders_v4
   ```
6. **Source Directory**: `.` (root)
7. Save and redeploy

## How Buildpack Works

1. **Detects**: Node.js app (finds `package.json` + `pnpm-lock.yaml`)
2. **Installs**: Node.js 24.2.0, pnpm 10.20.0 (from `package.json` `packageManager` field)
3. **Auto-installs deps**: Runs `pnpm install` at root (monorepo)
4. **Runs build_command**: Builds shared packages
5. **Runs run_command**: Starts Ponder

## What Changed

- ✅ Added `packageManager: "pnpm@9.15.0"` to root `package.json` (fixes warning)
- ✅ Created `app-buildpack.yaml` (no Docker, uses buildpacks)
- ✅ Set proper `build_command` and `run_command` for monorepo

The buildpack approach is actually **simpler** and matches Ponder's self-hosting docs perfectly!
