# Troubleshooting: "Failed to load news" Error

## What's Happening

Your app deployed successfully, but you're getting "Failed to load news" because:

1. ✅ **Build succeeded** - Code compiles fine
2. ❌ **Database is empty** - No headlines exist yet
3. ❌ **Cron job hasn't run** - GitHub Actions cron hasn't populated the database

## Quick Fix Steps

### 1. Test the Cron Job Manually

1. Go to your GitHub repository → **Actions** tab
2. Find **"Fetch Headlines"** workflow
3. Click **"Run workflow"** button
4. Wait for it to complete (should take 1-2 minutes)

### 2. Check Environment Variables in Vercel

Make sure these are set in your Vercel project dashboard:

**Required:**

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `CRON_SECRET_KEY` - Same value you set in GitHub secrets

**Optional:**

- `SUPABASE_SERVICE_ROLE_KEY` - For admin operations

### 3. Verify Database Connection

1. Go to your Supabase dashboard
2. Check if the `headlines` table exists
3. Check if it has any data
4. Verify your database is accessible

### 4. Check Vercel Function Logs

1. Go to Vercel dashboard → Your project
2. Click on the latest deployment
3. Go to **Functions** tab
4. Check `/api/news` function logs for errors

## Expected Behavior

### After Cron Job Runs Successfully:

- Database will be populated with headlines
- Your app will show news articles
- Error message will disappear

### If Still Getting Errors:

- Check GitHub Actions logs for cron job failures
- Verify all environment variables are set correctly
- Check Supabase database permissions

## Common Issues

### Issue: "No headlines found in database"

**Solution:** Run the cron job manually via GitHub Actions

### Issue: "Database connection failed"

**Solution:** Check Supabase environment variables in Vercel

### Issue: "Unauthorized" errors

**Solution:** Verify `CRON_SECRET_KEY` matches in both GitHub and Vercel

## Testing the Fix

1. **Deploy the updated code** (with better error messages)
2. **Run the cron job manually** via GitHub Actions
3. **Check your app** - should now show news or a helpful message
4. **Monitor the cron job** - should run automatically every 30 minutes

## Next Steps

Once the cron job runs successfully:

1. Your database will be populated with headlines
2. The app will work normally
3. News will refresh automatically every 30 minutes
4. You can monitor everything in GitHub Actions

The error should resolve itself once the cron job populates your database with headlines!
