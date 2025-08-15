-- Create headlines table for centralized headline storage
CREATE TABLE IF NOT EXISTS headlines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  publishedAt TIMESTAMP WITH TIME ZONE NOT NULL,
  source TEXT NOT NULL DEFAULT 'ABC News',
  fetchedAt TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_headlines_published_at ON headlines(publishedAt DESC);
CREATE INDEX IF NOT EXISTS idx_headlines_fetched_at ON headlines(fetchedAt DESC);
CREATE INDEX IF NOT EXISTS idx_headlines_source ON headlines(source);

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

-- Insert some sample data for testing
INSERT INTO headlines (id, title, url, publishedAt, source, fetchedAt) VALUES
  ('sample-1', 'Sample Headline 1', 'https://example.com/1', NOW() - INTERVAL '1 hour', 'ABC News', NOW()),
  ('sample-2', 'Sample Headline 2', 'https://example.com/2', NOW() - INTERVAL '2 hours', 'ABC News', NOW())
ON CONFLICT (url) DO NOTHING;
