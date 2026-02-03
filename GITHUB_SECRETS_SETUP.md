# Quick Fix: Add Missing GitHub Secrets

## The Problem

Your GitHub Actions workflow is failing because `BASE_URL` is not set.

## Quick Fix (2 minutes)

### 1. Go to Your GitHub Repository

- Navigate to: `https://github.com/mrhemsing/5news`
- Click **Settings** tab
- Click **Secrets and variables** → **Actions**

### 2. Add BASE_URL Secret

- Click **New repository secret**
- **Name**: `BASE_URL`
- **Value**: Your Vercel app URL (e.g., `https://5news.vercel.app`)

### 3. Add CRON_SECRET_KEY Secret (if not already there)

- Click **New repository secret** again
- **Name**: `CRON_SECRET_KEY`
- **Value**: A random secret key (e.g., `my-secret-key-123`)

### 4. Test the Workflow

- Go to **Actions** tab
- Find "Fetch Headlines" workflow
- Click **Run workflow**

## What BASE_URL Should Look Like

**Examples:**

- `https://5news.vercel.app`
- `https://your-app-name.vercel.app`
- `https://your-custom-domain.com`

**Important:**

- ✅ Include `https://`
- ❌ Don't end with `/`
- ✅ Use your actual Vercel app URL

## How to Find Your Vercel URL

1. Go to [vercel.com](https://vercel.com)
2. Sign in and find your project
3. Copy the URL from the top of your project dashboard
4. It should look like: `https://5news-xxxxx.vercel.app`

## After Adding Secrets

1. **Commit and push** the updated workflow file
2. **Go to Actions tab** and manually run "Fetch Headlines"
3. **Check the logs** - should now show "✅ BASE_URL is set"
4. **The cron job should succeed** and populate your database

## Add Supabase Storage secrets (for durable thumbnails)

To prevent thumbnails from disappearing (Replicate delivery URLs expire), the app can upload images to **Supabase Storage**.

Add these **Vercel environment variables** (Project → Settings → Environment Variables):

- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - Find it in Supabase: Project Settings → API → **service_role** key
  - ⚠️ Keep private. Never expose to the browser.

Optional:
- `SUPABASE_STORAGE_BUCKET` (default: `cartoons`)

Also create a Supabase Storage bucket:
- Bucket name: `cartoons` (or match `SUPABASE_STORAGE_BUCKET`)
- Access: **Public** (read)

## Expected Result

Once the secrets are added:

- ✅ Workflow will show "BASE_URL is set"
- ✅ Will make successful HTTP request to your API
- ✅ Your database will be populated with headlines
- ✅ Your app will work normally

The error should be completely resolved once you add the `BASE_URL` secret!
