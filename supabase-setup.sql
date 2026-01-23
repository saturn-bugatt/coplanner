-- CoPlanner Supabase Setup
-- Run this SQL in the Supabase SQL Editor to set up the required tables and storage

-- =====================
-- SCORES TABLE
-- =====================
-- Stores team scores from the AI analysis

CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  repo TEXT NOT NULL,
  track INTEGER NOT NULL DEFAULT 1,
  problem INTEGER NOT NULL DEFAULT 0,
  solution INTEGER NOT NULL DEFAULT 0,
  execution INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  lines_of_code INTEGER NOT NULL DEFAULT 0,
  commentary TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_scores_total ON scores(total DESC);
CREATE INDEX IF NOT EXISTS idx_scores_team_id ON scores(team_id);

-- Enable Row Level Security
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Allow public read access to scores
CREATE POLICY "Allow public read access to scores" ON scores
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update scores (for the analysis script)
CREATE POLICY "Allow public insert on scores" ON scores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on scores" ON scores
  FOR UPDATE USING (true);

-- =====================
-- PHOTOS TABLE
-- =====================
-- Stores photo metadata for the photo booth feature

CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  email TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching team photos
CREATE INDEX IF NOT EXISTS idx_photos_team ON photos(team_name);
CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at DESC);

-- Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Allow public access to photos
CREATE POLICY "Allow public read access to photos" ON photos
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert on photos" ON photos
  FOR INSERT WITH CHECK (true);

-- =====================
-- QUEUE TABLE
-- =====================
-- Stores the booth display queue

CREATE TABLE IF NOT EXISTS queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'displaying', 'done'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  displayed_at TIMESTAMPTZ
);

-- Index for queue management
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_created ON queue(created_at);

-- Enable Row Level Security
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

-- Allow public access to queue
CREATE POLICY "Allow public read access to queue" ON queue
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert on queue" ON queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on queue" ON queue
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on queue" ON queue
  FOR DELETE USING (true);

-- =====================
-- COMMENTARY TABLE (optional)
-- =====================
-- Stores generated hype commentary for the leaderboard

CREATE TABLE IF NOT EXISTS commentary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  team_name TEXT,
  event_type TEXT, -- 'rank_change', 'score_update', 'new_team', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching recent commentary
CREATE INDEX IF NOT EXISTS idx_commentary_created ON commentary(created_at DESC);

-- Enable Row Level Security
ALTER TABLE commentary ENABLE ROW LEVEL SECURITY;

-- Allow public access to commentary
CREATE POLICY "Allow public read access to commentary" ON commentary
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert on commentary" ON commentary
  FOR INSERT WITH CHECK (true);

-- =====================
-- STORAGE BUCKET
-- =====================
-- Create a storage bucket for photos
-- NOTE: This must be done in the Supabase Dashboard Storage section
--
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name it "photos"
-- 4. Enable "Public bucket" (so images can be displayed)
-- 5. Save

-- Alternatively, use the Supabase CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

-- =====================
-- REALTIME SUBSCRIPTIONS
-- =====================
-- Enable realtime for tables that need live updates

ALTER PUBLICATION supabase_realtime ADD TABLE photos;
ALTER PUBLICATION supabase_realtime ADD TABLE queue;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE commentary;

-- =====================
-- DONE!
-- =====================
-- After running this SQL:
-- 1. Create the "photos" storage bucket (public) in the Dashboard
-- 2. Test the app at /photos to upload a photo
-- 3. Run the analysis script: npx tsx scripts/analyze.ts
