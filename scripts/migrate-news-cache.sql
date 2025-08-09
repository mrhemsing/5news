-- Migration script to update news_cache table for 48-hour retention
-- Run this in your Supabase SQL editor

-- Step 1: Drop the unique constraint on date
ALTER TABLE news_cache DROP CONSTRAINT IF EXISTS news_cache_date_key;

-- Step 2: Add page column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'news_cache' AND column_name = 'page') THEN
        ALTER TABLE news_cache ADD COLUMN page INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Step 3: Create index on page column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_news_cache_page ON news_cache(page);

-- Step 4: Update existing records to have page = 1
UPDATE news_cache SET page = 1 WHERE page IS NULL;

-- Step 5: Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'news_cache'
ORDER BY ordinal_position;

-- Step 6: Check existing data
SELECT
    date,
    page,
    created_at,
    jsonb_array_length(articles) as article_count
FROM news_cache
ORDER BY created_at DESC
LIMIT 10;
