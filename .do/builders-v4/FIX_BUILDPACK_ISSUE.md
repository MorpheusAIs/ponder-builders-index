# Fix: Buildpack Detection Instead of Dockerfile

## Problem
DigitalOcean App Platform is detecting buildpacks instead of using the Dockerfile, causing build failures.

## Solution: Force Dockerfile Usage

### Option 1: Update App Spec via doctl (Recommended)

1. **Get your app ID:**
   ```bash
   doctl apps list
   ```
   Look for `builders-v4-index` and note the ID.

2. **Update the app with the correct spec:**
   ```bash
   doctl apps update <APP_ID> --spec .do/builders-v4/app.yaml
   ```

3. **Verify the update:**
   ```bash
   doctl apps get <APP_ID> --format Spec
   ```
   Check that `dockerfile_path` is set correctly.

### Option 2: Fix via DigitalOcean UI

1. Go to **DigitalOcean Dashboard** → **Apps** → **builders-v4-index**
2. Click **Settings** → **Components**
3. Find the **builders-v4** service
4. Click **Edit** on the service
5. Scroll to **Build Settings** section
6. **Change Build Method**:
   - Look for "Build Method" or "Build Type" dropdown
   - Change from **"Buildpack"** to **"Dockerfile"**
7. **Set Dockerfile Path**:
   - Dockerfile Path: `apps/ponder-builders-v4-base-sepolia/Dockerfile.production`
   - Source Directory: `.` (root)
8. **Remove Build Command** (if present):
   - Leave Build Command empty
   - Leave Run Command empty
9. Click **Save**
10. Trigger a new deployment

### Option 3: Delete and Recreate Service

If editing doesn't work:

1. **Delete the service** (not the app):
   - Go to App Settings → Components
   - Delete the `builders-v4` service
2. **Add new service**:
   - Click **Add Component** → **Service**
   - Configure:
     - Name: `builders-v4`
     - Source Directory: `.`
     - **Build Method**: **Dockerfile** (select explicitly)
     - Dockerfile Path: `apps/ponder-builders-v4-base-sepolia/Dockerfile.production`
     - HTTP Port: `42069`
     - Instance Size: `Basic XXS`
3. **Re-add environment variables** (they should be preserved, but verify)
4. **Link database** (should auto-link if configured)

## Verification

After fixing, check the build logs. You should see:
- ✅ `=> Building Docker image`
- ✅ `=> Using Dockerfile: apps/ponder-builders-v4-base-sepolia/Dockerfile.production`
- ❌ NOT `buildpack detection` or `Installing binaries`

## Why This Happens

DigitalOcean App Platform auto-detects buildpacks when it finds:
- `package.json` in root
- `Procfile` in root
- No explicit Dockerfile path set

Even though `dockerfile_path` is in the YAML, if the app was created via UI first, it might have defaulted to buildpack mode.

## Prevention

Always specify `dockerfile_path` in the YAML spec and deploy via `doctl` or ensure Dockerfile is selected when creating via UI.

