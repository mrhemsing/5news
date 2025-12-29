-- Create rate limit lock table for distributed rate limiting across serverless instances
CREATE TABLE IF NOT EXISTS rate_limit_lock (
  id TEXT PRIMARY KEY DEFAULT 'replicate_api',
  last_request TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_lock_id ON rate_limit_lock(id);

-- Enable RLS
ALTER TABLE rate_limit_lock ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow public read access to rate_limit_lock" ON rate_limit_lock
  FOR SELECT USING (true);

-- Allow public to update (needed for rate limiting across instances)
CREATE POLICY "Allow public update access to rate_limit_lock" ON rate_limit_lock
  FOR UPDATE USING (true);

-- Allow public to insert (needed for initial setup)
CREATE POLICY "Allow public insert access to rate_limit_lock" ON rate_limit_lock
  FOR INSERT WITH CHECK (true);

-- Insert initial lock entry
INSERT INTO rate_limit_lock (id, last_request, updated_at)
VALUES ('replicate_api', NOW() - INTERVAL '1 minute', NOW())
ON CONFLICT (id) DO NOTHING;

