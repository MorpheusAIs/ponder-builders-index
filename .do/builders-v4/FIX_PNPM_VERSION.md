# Fix: DigitalOcean Buildpack pnpm Version Mismatch

## Problem

The buildpack is using `pnpm@10.20.0` (latest) but the lockfile is version `9.0` (pnpm v9). This causes:
- Version mismatch warnings
- Potential build failures
- Incompatibility issues

## Solution

Updated `build_command` in `app-buildpack.yaml` to:
1. Enable corepack
2. Prepare and activate pnpm@9.15.0 (matching `packageManager` field)
3. Build shared packages

**Note:** The buildpack auto-installs dependencies, so we don't need to run `pnpm install` in the build_command.

## Updated Build Command

```yaml
build_command: corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm --filter @morpheusai/shared-abis build
```

## Alternative: Let Buildpack Handle It

If corepack isn't available in the buildpack environment, we can:
1. Update lockfile to pnpm v10 (not recommended - breaking change)
2. Or rely on buildpack's auto-detection and hope pnpm 10 works with lockfile v9

## Verification

After updating, the build should:
- ✅ Use pnpm 9.15.0 (matching lockfile)
- ✅ Install dependencies correctly
- ✅ Build shared-abis package
- ✅ Start the app successfully

