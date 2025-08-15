# 🕐 Cron Job Setup for Background Headline Fetching

## Overview

This system now fetches headlines from RSS feeds every 30 minutes and stores them centrally in Supabase, eliminating the need to fetch from RSS on every user request.

## 🚀 Benefits

- **Consistent Headlines**: All users see the same headlines from a central database
- **Faster Response**: No more waiting for RSS feeds to load
- **Better Performance**: Reduced API calls and improved user experience
- **Reliable Updates**: Scheduled background updates every 30 minutes

## 🔧 Setup Steps

### 1. Environment Variables

Add these to your `.env.local`:

```bash
CRON_SECRET_KEY=your-secret-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Supabase Database

Run the migration in `supabase-migrations/001_create_headlines_table.sql` to create the headlines table.

### 3. Cron Job Setup

#### Option A: Vercel Cron Jobs (Recommended)

Add this to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-headlines",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

#### Option B: External Cron Service

Use a service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com):

**URL**: `https://your-domain.vercel.app/api/cron/fetch-headlines`
**Headers**: `Authorization: Bearer your-secret-key-here`
**Schedule**: Every 30 minutes (`*/30 * * * *`)

#### Option C: GitHub Actions

Create `.github/workflows/fetch-headlines.yml`:

```yaml
name: Fetch Headlines
on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:

jobs:
  fetch-headlines:
    runs-on: ubuntu-latest
    steps:
      - name: Fetch Headlines
        run: |
          curl -X GET "https://your-domain.vercel.app/api/cron/fetch-headlines" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET_KEY }}"
```

## 📊 How It Works

1. **Every 30 minutes**: Cron job calls `/api/cron/fetch-headlines`
2. **RSS Fetching**: Fetches fresh headlines from Google News RSS feeds
3. **Processing**: Filters, deduplicates, and sorts headlines
4. **Database Storage**: Stores in Supabase `headlines` table
5. **User Requests**: Frontend fetches from database instead of RSS
6. **Consistency**: All users see the same headlines

## 🔒 Security

- The cron endpoint is protected with `CRON_SECRET_KEY`
- Only service role can write to the database
- Public read access for headlines

## 📱 Frontend Changes

The main news API (`/api/news`) now:

- Fetches from Supabase database instead of RSS
- Provides consistent headlines across all devices
- Includes pagination and sorting
- Shows database timestamp for transparency

## 🧪 Testing

1. Deploy the changes
2. Set up the cron job
3. Wait for the first scheduled run
4. Check the database for headlines
5. Verify the frontend shows consistent data

## 📈 Monitoring

Check Vercel logs for:

- `🕐 Starting scheduled headline fetch...`
- `✅ Successfully updated X headlines in central database`
- Any errors in the cron job execution
