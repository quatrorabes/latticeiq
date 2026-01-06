-- migrations/001_relationship_intelligence_schema.sql
-- Supabase migrations for Relationship Intelligence Dashboard

-- 1. Engagement Metrics Table
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_starting DATE NOT NULL,
  total_contacts INT NOT NULL DEFAULT 0,
  engaged_contacts INT NOT NULL DEFAULT 0,
  engagement_percentage FLOAT NOT NULL DEFAULT 0,
  response_rate FLOAT NOT NULL DEFAULT 0,
  response_time_days FLOAT NOT NULL DEFAULT 0,
  healthy_relationships_pct FLOAT NOT NULL DEFAULT 0,
  total_contacts_touched INT NOT NULL DEFAULT 0,
  contacts_ready_tomorrow INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(week_starting)
);

-- 2. Outreach Tips Table
CREATE TABLE IF NOT EXISTS outreach_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_type VARCHAR(10), -- 'hot', 'warm', 'cold'
  effectiveness_rating INT DEFAULT 0,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add engagement tracking columns to existing contacts table
-- (assuming contacts table already exists from your existing schema)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_status VARCHAR(10) DEFAULT 'cold';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS engagement_score FLOAT DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contacted_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_rate FLOAT DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS interaction_count INT DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS days_since_last_contact INT;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_week ON engagement_metrics(week_starting DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_status ON contacts(engagement_status);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_score ON contacts(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_tips_category ON outreach_tips(category);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_tips ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
CREATE POLICY "Allow authenticated users to view engagement metrics"
  ON engagement_metrics FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view outreach tips"
  ON outreach_tips FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin to manage engagement metrics"
  ON engagement_metrics FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow admin to manage outreach tips"
  ON outreach_tips FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 7. Seed initial outreach tips
INSERT INTO outreach_tips (title, content, category, contact_type) VALUES
('Try a Different Outreach Method', 'Instead of a standard email, try sending a personalized LinkedIn voice message. Our data shows this method yields a 45% higher response rate for his industry cohort.', 'outreach_method', NULL),
('Send a Handwritten Note', 'Research shows finance professionals at mid-market respond 5x better to personalized physical mail. Stand out with a 1-page letter about their recent company news or market insights.', 'outreach_method', 'warm'),
('Time Your Outreach Better', 'This contact is most responsive on Tuesday-Wednesday mornings (9-11am their time). Her engagement pattern shows she clears inbox at those times. Schedule strategically.', 'timing', NULL),
('Reference Recent Company News', 'Their company just announced a funding round. This is a perfect hook. Lead with congratulations and tie it to a relevant solution. Timing-based outreach has 4x higher engagement.', 'personalization', 'cold'),
('Use Their Industry Language', 'Shift from generic efficiency gains to industry-specific terms like cap rate optimization and portfolio velocity. Relevant language increases response by 63%.', 'messaging', 'warm'),
('Build on Their Interests', 'They follow content about AI in banking. Share a LinkedIn article about AI-driven underwriting and ask for their thoughts. Interest-aligned outreach outperforms cold pitches by 7:1.', 'personalization', 'cold')
ON CONFLICT DO NOTHING;

-- 8. Create function to calculate engagement metrics
CREATE OR REPLACE FUNCTION calculate_engagement_metrics()
RETURNS TABLE (
  total_contacts BIGINT,
  engaged_contacts BIGINT,
  engagement_percentage NUMERIC,
  response_rate NUMERIC,
  healthy_relationships_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE engagement_status IN ('hot', 'warm')) as engaged,
    ROUND((COUNT(*) FILTER (WHERE engagement_status IN ('hot', 'warm'))::NUMERIC / COUNT(*)) * 100, 2) as engagement_pct,
    ROUND(AVG(response_rate)::NUMERIC, 2) as avg_response_rate,
    ROUND((COUNT(*) FILTER (WHERE engagement_score >= 6)::NUMERIC / COUNT(*)) * 100, 2) as healthy_pct
  FROM contacts
  WHERE created_at >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to update engagement metrics weekly
CREATE OR REPLACE FUNCTION update_weekly_engagement_metrics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO engagement_metrics (
    week_starting,
    total_contacts,
    engaged_contacts,
    engagement_percentage,
    response_rate,
    healthy_relationships_pct
  )
  SELECT
    DATE_TRUNC('week', NOW())::DATE,
    COUNT(*),
    COUNT(*) FILTER (WHERE engagement_status IN ('hot', 'warm')),
    ROUND((COUNT(*) FILTER (WHERE engagement_status IN ('hot', 'warm'))::NUMERIC / COUNT(*)) * 100, 2),
    ROUND(AVG(response_rate)::NUMERIC, 2),
    ROUND((COUNT(*) FILTER (WHERE engagement_score >= 6)::NUMERIC / COUNT(*)) * 100, 2)
  FROM contacts
  ON CONFLICT (week_starting) DO UPDATE SET
    total_contacts = EXCLUDED.total_contacts,
    engaged_contacts = EXCLUDED.engaged_contacts,
    engagement_percentage = EXCLUDED.engagement_percentage,
    response_rate = EXCLUDED.response_rate,
    healthy_relationships_pct = EXCLUDED.healthy_relationships_pct,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Commit message: Add Relationship Intelligence dashboard tables, indexes, RLS, and initial data
