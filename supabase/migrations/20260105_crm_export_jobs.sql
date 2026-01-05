-- ============================================================================
-- CRM Export Jobs Table
-- Migration: 20260105_crm_export_jobs.sql
-- Purpose: Track bulk export jobs to Salesforce, Pipedrive, and CSV exports
-- ============================================================================

-- Create enum for export platforms
DO $$ BEGIN
    CREATE TYPE crm_export_platform AS ENUM (
        'salesforce',
        'pipedrive', 
        'csv_google',
        'csv_outlook',
        'csv_generic',
        'hubspot'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for export job status
DO $$ BEGIN
    CREATE TYPE crm_export_status AS ENUM (
        'pending',
        'processing',
        'completed',
        'partial',
        'failed',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the crm_export_jobs table
CREATE TABLE IF NOT EXISTS crm_export_jobs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to user who initiated the export
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Export configuration
    platform crm_export_platform NOT NULL,
    status crm_export_status DEFAULT 'pending',
    
    -- Contact selection (array of contact IDs to export)
    contact_ids UUID[] NOT NULL DEFAULT '{}',
    
    -- Progress tracking
    total_contacts INTEGER NOT NULL DEFAULT 0,
    processed_contacts INTEGER DEFAULT 0,
    successful_exports INTEGER DEFAULT 0,
    failed_exports INTEGER DEFAULT 0,
    
    -- Results storage
    results JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{ contact_id, status, external_id, error, exported_at }]
    
    -- Field mapping configuration (optional custom mapping)
    field_mapping JSONB DEFAULT '{}'::jsonb,
    
    -- Export options
    options JSONB DEFAULT '{}'::jsonb,
    -- Examples:
    -- { "include_enrichment": true, "include_scores": true }
    -- { "csv_format": "google_contacts" }
    -- { "create_as_leads": true, "assign_to": "user_id" }
    
    -- Error tracking
    error_message TEXT,
    error_details JSONB DEFAULT '{}'::jsonb,
    
    -- File storage (for CSV exports)
    file_url TEXT,
    file_name TEXT,
    file_size_bytes INTEGER,
    
    -- External reference (for CRM platforms)
    external_job_id TEXT,
    external_batch_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_user_id 
    ON crm_export_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_status 
    ON crm_export_jobs(status);

CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_platform 
    ON crm_export_jobs(platform);

CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_created_at 
    ON crm_export_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_user_status 
    ON crm_export_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_user_platform 
    ON crm_export_jobs(user_id, platform);

-- Create index for finding recent jobs
CREATE INDEX IF NOT EXISTS idx_crm_export_jobs_user_recent 
    ON crm_export_jobs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE crm_export_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own export jobs
CREATE POLICY "Users can view own export jobs"
    ON crm_export_jobs
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own export jobs"
    ON crm_export_jobs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own export jobs"
    ON crm_export_jobs
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own export jobs"
    ON crm_export_jobs
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- CRM Integration Credentials Table
-- Store user's CRM API credentials securely
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Platform identifier
    platform crm_export_platform NOT NULL,
    
    -- OAuth tokens (encrypted in production)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- API key (for platforms that use API keys)
    api_key TEXT,
    
    -- Instance/domain info
    instance_url TEXT,  -- e.g., https://yourcompany.my.salesforce.com
    domain TEXT,        -- e.g., yourcompany for Pipedrive
    
    -- Connection status
    is_connected BOOLEAN DEFAULT FALSE,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one credential per platform per user
    CONSTRAINT unique_user_platform UNIQUE(user_id, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_credentials_user_id 
    ON crm_credentials(user_id);

CREATE INDEX IF NOT EXISTS idx_crm_credentials_platform 
    ON crm_credentials(platform);

-- Enable RLS
ALTER TABLE crm_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own credentials"
    ON crm_credentials
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
    ON crm_credentials
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
    ON crm_credentials
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
    ON crm_credentials
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- Export History View (for analytics)
-- ============================================================================

CREATE OR REPLACE VIEW export_history AS
SELECT 
    cej.id,
    cej.user_id,
    cej.platform::text as platform,
    cej.status::text as status,
    cej.total_contacts,
    cej.successful_exports,
    cej.failed_exports,
    cej.created_at,
    cej.completed_at,
    EXTRACT(EPOCH FROM (cej.completed_at - cej.started_at)) as duration_seconds,
    CASE 
        WHEN cej.total_contacts > 0 
        THEN ROUND((cej.successful_exports::numeric / cej.total_contacts) * 100, 2)
        ELSE 0 
    END as success_rate
FROM crm_export_jobs cej
WHERE cej.status IN ('completed', 'partial', 'failed')
ORDER BY cej.created_at DESC;

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_export_job_progress(
    p_job_id UUID,
    p_processed INTEGER,
    p_successful INTEGER,
    p_failed INTEGER
)
RETURNS void AS $$
BEGIN
    UPDATE crm_export_jobs
    SET 
        processed_contacts = p_processed,
        successful_exports = p_successful,
        failed_exports = p_failed,
        status = CASE
            WHEN p_processed >= total_contacts AND p_failed = 0 THEN 'completed'::crm_export_status
            WHEN p_processed >= total_contacts AND p_failed > 0 THEN 'partial'::crm_export_status
            ELSE 'processing'::crm_export_status
        END,
        completed_at = CASE
            WHEN p_processed >= total_contacts THEN NOW()
            ELSE completed_at
        END
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as failed
CREATE OR REPLACE FUNCTION fail_export_job(
    p_job_id UUID,
    p_error_message TEXT,
    p_error_details JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
    UPDATE crm_export_jobs
    SET 
        status = 'failed'::crm_export_status,
        error_message = p_error_message,
        error_details = p_error_details,
        completed_at = NOW()
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's export stats
CREATE OR REPLACE FUNCTION get_user_export_stats(p_user_id UUID)
RETURNS TABLE (
    total_exports BIGINT,
    total_contacts_exported BIGINT,
    successful_exports BIGINT,
    failed_exports BIGINT,
    exports_by_platform JSONB,
    last_export_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_exports,
        COALESCE(SUM(cej.total_contacts), 0)::BIGINT as total_contacts_exported,
        COALESCE(SUM(cej.successful_exports), 0)::BIGINT as successful_exports,
        COALESCE(SUM(cej.failed_exports), 0)::BIGINT as failed_exports,
        COALESCE(
            jsonb_object_agg(
                cej.platform::text, 
                jsonb_build_object(
                    'count', COUNT(*),
                    'contacts', SUM(cej.total_contacts)
                )
            ),
            '{}'::jsonb
        ) as exports_by_platform,
        MAX(cej.created_at) as last_export_at
    FROM crm_export_jobs cej
    WHERE cej.user_id = p_user_id
    GROUP BY cej.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Add contacts export tracking columns (if not exists)
-- ============================================================================

DO $$
BEGIN
    -- Add last_exported_at to contacts table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'last_exported_at'
    ) THEN
        ALTER TABLE contacts ADD COLUMN last_exported_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add export_history JSONB to contacts table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'export_history'
    ) THEN
        ALTER TABLE contacts ADD COLUMN export_history JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger to update updated_at on crm_credentials
CREATE OR REPLACE FUNCTION update_crm_credentials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_crm_credentials_timestamp ON crm_credentials;
CREATE TRIGGER update_crm_credentials_timestamp
    BEFORE UPDATE ON crm_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_crm_credentials_timestamp();

-- ============================================================================
-- Grant permissions (for service role)
-- ============================================================================

GRANT ALL ON crm_export_jobs TO service_role;
GRANT ALL ON crm_credentials TO service_role;
GRANT SELECT ON export_history TO service_role;
GRANT EXECUTE ON FUNCTION update_export_job_progress TO service_role;
GRANT EXECUTE ON FUNCTION fail_export_job TO service_role;
GRANT EXECUTE ON FUNCTION get_user_export_stats TO service_role;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE crm_export_jobs IS 'Tracks bulk export jobs to CRM platforms (Salesforce, Pipedrive) and CSV exports';
COMMENT ON TABLE crm_credentials IS 'Stores user CRM API credentials and OAuth tokens';
COMMENT ON COLUMN crm_export_jobs.results IS 'Array of export results: [{contact_id, status, external_id, error}]';
COMMENT ON COLUMN crm_export_jobs.field_mapping IS 'Custom field mapping overrides for the export';
COMMENT ON COLUMN crm_export_jobs.options IS 'Export-specific options (include_enrichment, csv_format, etc.)';
COMMENT ON COLUMN crm_credentials.instance_url IS 'CRM instance URL (e.g., Salesforce org URL)';
