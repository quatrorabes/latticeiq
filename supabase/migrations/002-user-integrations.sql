-- ============================================================================
-- FILE: supabase/migrations/002-user-integrations.sql
-- PURPOSE: Store user CRM integration credentials securely
-- ============================================================================

-- User integrations table
CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Integration type
    provider TEXT NOT NULL CHECK (provider IN (
        'hubspot', 'salesforce', 'pipedrive', 
        'google_contacts', 'microsoft_contacts'
    )),
    
    -- Connection status
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN (
        'connected', 'disconnected', 'expired', 'error'
    )),
    
    -- Credentials (encrypted at rest by Supabase)
    -- For API key auth (HubSpot private app, Pipedrive)
    api_key TEXT,
    
    -- For OAuth auth (Salesforce, Google, Microsoft)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    oauth_metadata JSONB DEFAULT '{}',  -- Store scopes, instance URL, etc.
    
    -- Account info (cached from provider)
    account_id TEXT,                     -- Portal ID, org ID, etc.
    account_name TEXT,                   -- HubSpot portal name, SF org name
    account_email TEXT,                  -- Connected account email
    
    -- Import settings (user preferences)
    default_filters JSONB DEFAULT '{}',  -- Default import filters
    field_mapping JSONB DEFAULT '{}',    -- Custom field mappings
    
    -- Sync metadata
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    last_sync_count INTEGER DEFAULT 0,
    total_imported INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX idx_user_integrations_provider ON user_integrations(provider);
CREATE INDEX idx_user_integrations_status ON user_integrations(status);

-- RLS Policies
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own integrations
CREATE POLICY "Users can view own integrations"
    ON user_integrations FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own integrations
CREATE POLICY "Users can create own integrations"
    ON user_integrations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
    ON user_integrations FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
    ON user_integrations FOR DELETE
    USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_integrations_updated_at
    BEFORE UPDATE ON user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_integrations_updated_at();

-- Import history table (for audit trail)
CREATE TABLE IF NOT EXISTS import_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES user_integrations(id) ON DELETE SET NULL,
    
    -- Import details
    source TEXT NOT NULL,  -- 'hubspot', 'csv', etc.
    source_file_name TEXT, -- For CSV imports
    
    -- Results
    total_processed INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    
    -- Filters used
    filters_applied JSONB DEFAULT '{}',
    rejection_reasons JSONB DEFAULT '{}',
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
        'in_progress', 'completed', 'failed', 'cancelled'
    )),
    error_message TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_import_history_user_id ON import_history(user_id);
CREATE INDEX idx_import_history_source ON import_history(source);
CREATE INDEX idx_import_history_created_at ON import_history(created_at DESC);

-- RLS Policies
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import history"
    ON import_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own import history"
    ON import_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE user_integrations IS 'Stores user CRM integration credentials and settings';
COMMENT ON TABLE import_history IS 'Audit trail of all contact imports';
COMMENT ON COLUMN user_integrations.api_key IS 'Encrypted API key for key-based auth (HubSpot, Pipedrive)';
COMMENT ON COLUMN user_integrations.access_token IS 'OAuth access token (Salesforce, Google, Microsoft)';
COMMENT ON COLUMN user_integrations.default_filters IS 'User default import filter preferences as JSON';
