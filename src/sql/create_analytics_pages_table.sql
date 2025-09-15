-- Create analytics_pages table
CREATE TABLE IF NOT EXISTS analytics_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  template TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets JSONB DEFAULT '[]'::jsonb,
  layouts JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS analytics_pages_user_id_idx ON analytics_pages(user_id);
CREATE INDEX IF NOT EXISTS analytics_pages_created_at_idx ON analytics_pages(created_at);

-- Enable Row Level Security
ALTER TABLE analytics_pages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own analytics pages"
  ON analytics_pages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics pages"
  ON analytics_pages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics pages"
  ON analytics_pages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analytics pages"
  ON analytics_pages FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_analytics_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_analytics_pages_updated_at_trigger
  BEFORE UPDATE ON analytics_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_pages_updated_at();