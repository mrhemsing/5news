-- Fix existing headlines table by adding missing columns
-- Run this in your Supabase SQL editor

-- Add fetchedAt column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'headlines' AND column_name = 'fetchedAt') THEN
        ALTER TABLE headlines ADD COLUMN "fetchedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Update existing rows to have fetchedAt value
UPDATE headlines SET "fetchedAt" = NOW() WHERE "fetchedAt" IS NULL;

-- Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'headlines'
ORDER BY ordinal_position;

-- Check if we have any data
SELECT COUNT(*) as total_headlines FROM headlines;
