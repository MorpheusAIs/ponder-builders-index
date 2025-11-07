# Quick Deployment Guide

## Option 1: Create New App from YAML (Recommended)

Since you want a standalone builders-v4 deployment, create a NEW app:

1. Go to DigitalOcean Dashboard → Apps → Create App
2. Choose "Import from YAML" or "From GitHub"
3. If using GitHub:
   - Select repository: `MorpheusAIs/ponder-builders-index`
   - Branch: `main`
   - Then manually configure OR import the YAML

4. **To import YAML:**
   - Copy the contents of `.do/builders-v4/app.yaml`
   - In App Platform, look for "Import from YAML" or "Edit YAML" option
   - Paste the YAML content
   - The `dockerfile_path` will be automatically applied

## Option 2: Update Existing App via doctl CLI

```bash
# Get your app ID from the DigitalOcean dashboard
APP_ID="your-app-id-here"

# Update the app with the new spec
doctl apps update $APP_ID --spec .do/builders-v4/app.yaml
```

## Option 3: Manual Configuration in UI

If you're editing an existing service and can't change build strategy:

1. **Delete the existing service** (if it's not production)
2. **Add a new service** to your app
3. When adding the service:
   - Select "Dockerfile" as build method (not Buildpack)
   - Set Dockerfile path: `apps/ponder-builders-v4-base-sepolia/Dockerfile.production`
   - Set source directory: `.` (root)

## Important Notes

- The `dockerfile_path` in the YAML is **correct**: `apps/ponder-builders-v4-base-sepolia/Dockerfile.production`
- This path is relative to `source_dir: .` (the repo root)
- If the UI shows "Buildpack", it means the service was auto-detected incorrectly
- Creating a new app/service ensures Docker is used from the start

