-- ============================================================================
-- LATTICEIQ OUTREACH MODULE - Database Migration
-- Date: January 5, 2026
-- Description: Business profiles and generated outreach content
-- ============================================================================

-- Business Profiles: User's "What We Do Best" configuration
CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    
    -- Core Identity
    company_name TEXT NOT NULL,
    tagline TEXT,
    
    -- What You Do (Required)
    what_you_do TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    primary_value_prop TEXT NOT NULL,
    
    -- Differentiators
    unique_approach TEXT,
    key_features JSONB DEFAULT '[]',
    
    -- Social Proof
    case_studies JSONB DEFAULT '[]',
    testimonials JSONB DEFAULT '[]',
    notable_clients TEXT[] DEFAULT '{}',
    
    -- Tone & Style
    tone TEXT DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'bold', 'friendly')),
    avoid_phrases TEXT[] DEFAULT '{}',
    signature_phrases TEXT[] DEFAULT '{}',
    
    -- Sender Info
    sender_name TEXT,
    sender_title TEXT,
    sender_email TEXT,
    sender_linkedin TEXT,
    calendar_link TEXT,
    
    -- Metadata
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Content: Generated emails, scripts, LinkedIn messages
CREATE TABLE IF NOT EXISTS outreach_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    business_profile_id UUID REFERENCES business_profiles(id) ON DELETE SET NULL,
    
    -- Content Type
    content_type TEXT NOT NULL CHECK (content_type IN ('email', 'call_script', 'linkedin')),
    variant_number INT DEFAULT 1 CHECK (variant_number >= 1 AND variant_number <= 5),
    
    -- Email/Message Content
    subject TEXT,
    body TEXT NOT NULL,
    style TEXT,
    style_description TEXT,
    
    -- Quality Metrics
    quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 100),
    quality_notes TEXT,
    
    -- Usage Tracking
    is_favorite BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    send_method TEXT,
    
    -- Response Tracking
    opened BOOLEAN DEFAULT false,
    opened_at TIMESTAMPTZ,
    replied BOOLEAN DEFAULT false,
    replied_at TIMESTAMPTZ,
    reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'neutral', 'negative', 'meeting_booked')),
    
    -- AI Generation Metadata
    model_used TEXT,
    tokens_used INT,
    generation_cost DECIMAL(10, 6),
    prompt_version TEXT DEFAULT 'v1',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_outreach_contact_id ON outreach_content(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_content_type ON outreach_content(content_type);
CREATE INDEX IF NOT EXISTS idx_outreach_created_at ON outreach_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_profiles_default ON business_profiles(is_default) WHERE is_default = true;

-- Ensure only one default business profile per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_profile 
ON business_profiles(workspace_id, is_default) 
WHERE is_default = true;

-- Add outreach columns to contacts for quick access
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS outreach_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS outreach_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS emails_generated INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_email_id UUID;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE business_profiles IS 'User business profiles for AI-powered email personalization';
COMMENT ON TABLE outreach_content IS 'AI-generated outreach content (emails, call scripts, LinkedIn)';
COMMENT ON COLUMN business_profiles.case_studies IS 'JSON array: [{client, challenge, result, metric}]';
COMMENT ON COLUMN business_profiles.key_features IS 'JSON array: ["feature1", "feature2"]';
COMMENT ON COLUMN outreach_content.style IS 'Email approach: problem_agitate_solve, social_proof, value_first, trigger_event, mutual_connection';
