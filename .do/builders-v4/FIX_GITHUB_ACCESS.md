# Fixing GitHub Access for doctl

## Option 1: Reconnect GitHub in DigitalOcean Dashboard

1. Go to DigitalOcean Dashboard → **Settings** → **Integrations** → **GitHub**
2. Click **"Disconnect"** if already connected
3. Click **"Connect GitHub"**
4. Authorize with the GitHub account that has access to `MorpheusAIs/ponder-builders-index`
5. Grant necessary permissions

## Option 2: Use UI Instead (Recommended)

Since the UI doesn't require doctl GitHub access, use the step-by-step guide in `UI_DEPLOYMENT_STEPS.md`

## Option 3: Update Existing App

If you already have an app deployed:
1. Get the app ID from DigitalOcean dashboard
2. Update it: `doctl apps update <app-id> --spec .do/builders-v4/app.yaml`

Note: You'll still need GitHub access for the update to work if the repo is private.

