-- Fix existing headlines table by adding missing columns and handling case sensitivity
-- Run this in your Supabase SQL editor

-- First, let's see what we currently have
SELECT 'Current table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'headlines'
ORDER BY ordinal_position;

-- Drop the existing table completely and recreate it with proper case-sensitive columns
DROP TABLE IF EXISTS headlines CASCADE;

-- Create the table with proper quoted column names
CREATE TABLE headlines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  source TEXT NOT NULL DEFAULT 'ABC News',
  "fetchedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_headlines_published_at ON headlines("publishedAt" DESC);
CREATE INDEX idx_headlines_fetched_at ON headlines("fetchedAt" DESC);
CREATE INDEX idx_headlines_source ON headlines(source);

-- Create a function to automatically update created_at
CREATE OR REPLACE FUNCTION update_created_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update created_at
CREATE TRIGGER update_headlines_created_at
  BEFORE INSERT ON headlines
  FOR EACH ROW
  EXECUTE FUNCTION update_created_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE headlines ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read headlines
CREATE POLICY "Allow public read access to headlines" ON headlines
  FOR SELECT USING (true);

-- Only allow service role to insert/update/delete
CREATE POLICY "Allow service role full access to headlines" ON headlines
  FOR ALL USING (auth.role() = 'service_role');

-- No sample data - let the cron job populate with real headlines

-- Verify the final table structure
SELECT 'Final table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'headlines'
ORDER BY ordinal_position;

-- Check if we have any data
SELECT 'Data count:' as info;
SELECT COUNT(*) as total_headlines FROM headlines;
