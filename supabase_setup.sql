-- Create cartoon_cache table
CREATE TABLE IF NOT EXISTS cartoon_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL UNIQUE,
  cartoon_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create news_cache table
CREATE TABLE IF NOT EXISTS news_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  articles JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tts_cache table
CREATE TABLE IF NOT EXISTS tts_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text_hash TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(text_hash, voice_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cartoon_cache_headline ON cartoon_cache(headline);
CREATE INDEX IF NOT EXISTS idx_cartoon_cache_created_at ON cartoon_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_news_cache_date ON news_cache(date);
CREATE INDEX IF NOT EXISTS idx_news_cache_created_at ON news_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_tts_cache_text_hash ON tts_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_tts_cache_voice_id ON tts_cache(voice_id);
CREATE INDEX IF NOT EXISTS idx_tts_cache_created_at ON tts_cache(created_at);

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