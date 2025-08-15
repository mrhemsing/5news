# GitHub Actions Cron Jobs Setup

## What I've Set Up

I've moved your cron jobs from Vercel to GitHub Actions, which is more reliable and gives you better visibility.

### New Workflows Created:

1. **`.github/workflows/fetch-headlines.yml`** - Fetches headlines every 30 minutes
2. **`.github/workflows/generate-cartoons.yml`** - Generates cartoons every 30 minutes (updated)

## What You Need to Do

### 1. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, then add:

- `CRON_SECRET_KEY`: A secret key for securing your cron endpoints
- `BASE_URL`: Your Vercel app URL (e.g., `https://your-app.vercel.app`)

### 2. Generate a Cron Secret Key

Create a secure random string for `CRON_SECRET_KEY`. You can use this command:

```bash
# Generate a random 32-character string
openssl rand -hex 16
```

Or use an online generator and create something like: `my-super-secret-cron-key-2024`

### 3. Set the Same Secret in Vercel

Add this environment variable to your Vercel project:

- Go to Vercel Dashboard → Project Settings → Environment Variables
- Add: `CRON_SECRET_KEY` with the same value you used in GitHub

### 4. Test the Setup

1. **Manual Test**: Go to Actions tab in GitHub, find "Fetch Headlines" workflow, click "Run workflow"
2. **Check Logs**: Click on the workflow run to see the logs
3. **Verify API Call**: Check your Vercel function logs to see if the request was received

## How It Works

1. **GitHub Actions** runs every 30 minutes (using cron: `*/30 * * * *`)
2. **Makes HTTP POST request** to your Vercel API endpoint
3. **Your API validates** the `CRON_SECRET_KEY` header
4. **Processes headlines/cartoons** as before
5. **Stores results** in your Supabase database

## Benefits of GitHub Actions

✅ **More Reliable**: GitHub's infrastructure is very stable
✅ **Better Logging**: Full visibility into when jobs run and any errors
✅ **Manual Triggering**: Can run jobs on-demand via GitHub UI
✅ **No Vercel Plan Limits**: Cron jobs work on any Vercel plan
✅ **Version Control**: Cron job logic is in your codebase

## Monitoring

- **GitHub Actions**: Check the Actions tab for workflow runs
- **Vercel Logs**: Monitor your API function logs
- **Database**: Check Supabase for new headlines/cartoons

## Troubleshooting

### If headlines aren't being fetched:

1. Check GitHub Actions tab for failed workflows
2. Verify `CRON_SECRET_KEY` matches in both GitHub and Vercel
3. Check `BASE_URL` is correct
4. Look at Vercel function logs for errors

### If you want to change frequency:

Edit the cron expression in the workflow files:

- `*/30 * * * *` = Every 30 minutes
- `0 */1 * * *` = Every hour
- `0 0 * * *` = Daily at midnight

Your cron jobs are now running through GitHub Actions and will be much more reliable than Vercel's built-in cron!
