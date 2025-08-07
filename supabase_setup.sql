-- Create cartoon_cache table in Supabase
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS cartoon_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL UNIQUE,
  cartoon_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cartoon_cache_headline ON cartoon_cache(headline);
CREATE INDEX IF NOT EXISTS idx_cartoon_cache_created_at ON cartoon_cache(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE cartoon_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for this demo)
-- In production, you might want more restrictive policies
CREATE POLICY "Allow all operations" ON cartoon_cache
  FOR ALL USING (true);

-- Optional: Create a function to clean old entries
CREATE OR REPLACE FUNCTION clean_old_cartoons()
RETURNS void AS $$
BEGIN
  DELETE FROM cartoon_cache
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean old entries (if you have pg_cron extension)
-- SELECT cron.schedule('clean-old-cartoons', '0 2 * * *', 'SELECT clean_old_cartoons();');