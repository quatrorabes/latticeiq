# SQL MIGRATIONS: IMPLEMENTING THE NEW SCHEMA

## Overview

This document provides the exact SQL to implement the variables & fields architecture in Supabase.

Run these in order via Supabase SQL Editor.

---

## MIGRATION 1: Create users_settings Table

```sql
-- Migration 1: Users Settings
-- Purpose: Store workspace configuration, products, API keys

CREATE TABLE IF NOT EXISTS users_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL UNIQUE,
  
  -- User info
  user_email TEXT NOT NULL,
  company_name TEXT,
  industry TEXT,
  
  -- API Credentials (should be encrypted in production)
  hubspot_api_key TEXT,
  openai_api_key TEXT,
  perplexity_api_key TEXT,
  gmail_credentials JSONB,
  
  -- Company products and offerings
  products JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Default templates
  default_call_template_id UUID,
  default_email_template_id UUID,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT workspace_unique UNIQUE(workspace_id),
  CONSTRAINT valid_email CHECK (user_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_settings_workspace ON users_settings(workspace_id);
CREATE INDEX idx_users_settings_email ON users_settings(user_email);

-- Insert default for current user (if needed)
INSERT INTO users_settings (workspace_id, user_email, company_name, products)
VALUES (
  'default',
  'admin@latticeiq.com',
  'Your Company',
  '{
    "sba_504": {
      "name": "SBA 504 Loans",
      "description": "90% LTV, quick close",
      "ltv": 90,
      "close_days": 30,
      "min_loan": 100000,
      "max_loan": 10000000
    }
  }'::jsonb
) ON CONFLICT DO NOTHING;
```

---

## MIGRATION 2: Create ideal_client_profiles Table

```sql
-- Migration 2: Ideal Client Profiles
-- Purpose: Define ICPs with criteria and scoring weights

CREATE TABLE IF NOT EXISTS ideal_client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  
  -- Profile metadata
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  
  -- Filter criteria
  criteria JSONB NOT NULL,
  
  -- Scoring weights
  weights JSONB DEFAULT '{
    "industry_match": 0.3,
    "size_match": 0.2,
    "title_match": 0.2,
    "growth_signals": 0.2,
    "engagement_history": 0.1
  }'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT workspace_fk FOREIGN KEY(workspace_id) 
    REFERENCES users_settings(workspace_id) ON DELETE CASCADE,
  CONSTRAINT one_default_per_workspace 
    UNIQUE(workspace_id) WHERE is_default = TRUE
);

CREATE INDEX idx_icp_workspace ON ideal_client_profiles(workspace_id);
CREATE INDEX idx_icp_default ON ideal_client_profiles(workspace_id, is_default);

-- Insert default ICP for current user
INSERT INTO ideal_client_profiles (workspace_id, name, description, is_default, criteria)
VALUES (
  'default',
  'Starter ICP: Banking',
  'Commercial banks and credit unions',
  TRUE,
  '{
    "industry": ["Financial Services", "Banking", "Credit Union"],
    "company_size": {
      "min_revenue_millions": 50,
      "max_revenue_millions": 500,
      "min_employees": 100
    },
    "job_titles": ["VP Lending", "Commercial Banker", "Loan Officer"],
    "geography": ["CA", "NY", "TX"]
  }'::jsonb
) ON CONFLICT DO NOTHING;
```

---

## MIGRATION 3: Create contact_field_definitions Table

```sql
-- Migration 3: Contact Field Definitions
-- Purpose: Metadata about what fields exist and how to query them

CREATE TABLE IF NOT EXISTS contact_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  
  -- Field metadata
  field_name TEXT NOT NULL,
  display_name TEXT,
  field_type TEXT NOT NULL,
  
  -- Source and access
  source TEXT NOT NULL,
  source_field TEXT,
  jsonb_path TEXT,
  
  -- Querying hints
  is_indexed BOOLEAN DEFAULT FALSE,
  is_searchable BOOLEAN DEFAULT FALSE,
  
  -- UI hints
  is_filterable BOOLEAN DEFAULT TRUE,
  is_displayable BOOLEAN DEFAULT TRUE,
  sort_priority INT DEFAULT 0,
  
  -- Validation
  validation_rule JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT workspace_fk FOREIGN KEY(workspace_id) 
    REFERENCES users_settings(workspace_id) ON DELETE CASCADE,
  CONSTRAINT unique_field_per_workspace UNIQUE(workspace_id, field_name),
  CONSTRAINT valid_type CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'array', 'float', 'bigint'))
);

CREATE INDEX idx_field_def_workspace ON contact_field_definitions(workspace_id);
CREATE INDEX idx_field_def_source ON contact_field_definitions(workspace_id, source);

-- Insert common enrichment fields
INSERT INTO contact_field_definitions (
  workspace_id, field_name, display_name, field_type, source, jsonb_path, 
  is_indexed, is_searchable, is_filterable, sort_priority, validation_rule
) VALUES
('default', 'enrichment_company_name', 'Company Name', 'text', 'perplexity', 
 "enrichment_data->'company'->>'name'", TRUE, TRUE, TRUE, 10, '{"type":"text","max_length":255}'::jsonb),

('default', 'enrichment_company_revenue', 'Company Revenue', 'bigint', 'perplexity',
 "enrichment_data->'company'->>'revenue'", TRUE, FALSE, TRUE, 20, '{"type":"number","min":0,"unit":"USD"}'::jsonb),

('default', 'enrichment_company_employees', 'Company Employees', 'number', 'perplexity',
 "enrichment_data->'company'->>'employees'", TRUE, FALSE, TRUE, 30, '{"type":"number","min":0}'::jsonb),

('default', 'enrichment_company_industry', 'Industry', 'text', 'perplexity',
 "enrichment_data->'company'->>'industry'", TRUE, TRUE, TRUE, 40, '{"type":"text"}'::jsonb),

('default', 'enrichment_company_growth_yoy', 'YoY Growth', 'float', 'perplexity',
 "enrichment_data->'company'->>'growth_yoy'", TRUE, FALSE, TRUE, 50, '{"type":"float","min":0,"unit":"percent"}'::jsonb),

('default', 'kernel_who_persona', 'Persona Type', 'text', 'kernel',
 "kernel_analysis->'who'->>'persona_type'", TRUE, FALSE, TRUE, 60, '{"type":"text"}'::jsonb),

('default', 'kernel_when_urgency', 'Urgency Level', 'text', 'kernel',
 "kernel_analysis->'when'->>'urgency_level'", TRUE, FALSE, TRUE, 70, '{"type":"text","enum":["high","medium","low"]}'::jsonb)
ON CONFLICT DO NOTHING;
```

---

## MIGRATION 4: Create campaigns Table

```sql
-- Migration 4: Campaigns
-- Purpose: Track outreach campaigns

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  
  -- Campaign info
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Configuration
  channel TEXT NOT NULL,
  email_template_id UUID,
  call_template_id UUID,
  
  -- Targeting criteria
  target_filters JSONB,
  
  -- Schedule
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  send_time TIME,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  throttle_rate INT DEFAULT 1,
  
  -- Results
  total_sent INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_clicked INT DEFAULT 0,
  total_replied INT DEFAULT 0,
  total_meetings_booked INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT workspace_fk FOREIGN KEY(workspace_id) 
    REFERENCES users_settings(workspace_id) ON DELETE CASCADE,
  CONSTRAINT valid_channel CHECK (channel IN ('email', 'phone', 'linkedin', 'sms')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'paused', 'completed'))
);

CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON campaigns(workspace_id, status);
CREATE INDEX idx_campaigns_dates ON campaigns(workspace_id, start_date, end_date);
```

---

## MIGRATION 5: Create email_templates Table

```sql
-- Migration 5: Email Templates
-- Purpose: Store reusable email templates with variable substitution

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  
  -- Template content (supports {{variable}} substitution)
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  cta_text TEXT,
  cta_link TEXT,
  
  -- Available variables (for UI hints)
  available_variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Usage tracking
  is_default BOOLEAN DEFAULT FALSE,
  usage_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT workspace_fk FOREIGN KEY(workspace_id) 
    REFERENCES users_settings(workspace_id) ON DELETE CASCADE,
  CONSTRAINT unique_name_per_workspace UNIQUE(workspace_id, name),
  CONSTRAINT one_default_per_workspace 
    UNIQUE(workspace_id) WHERE is_default = TRUE
);

CREATE INDEX idx_email_templates_workspace ON email_templates(workspace_id);

-- Insert default template
INSERT INTO email_templates (
  workspace_id, name, category, is_default,
  subject_template, body_template, cta_text, cta_link,
  available_variables
) VALUES (
  'default',
  'Default: SBA 504',
  'sba',
  TRUE,
  '{{company}} - SBA 504 Partnership',
  'Hi {{first_name}},

I noticed {{company}} is expanding their SBA lending program.

We specialize in SBA 504 partnerships - {{product_ltv}}% LTV, {{product_close_days}} day closes.

Would be great to grab coffee and discuss how we can help.

Best,
Your Name',
  'Schedule Call',
  'https://calendly.com/your-domain/15min',
  ARRAY['first_name', 'company', 'product_ltv', 'product_close_days']::TEXT[]
) ON CONFLICT DO NOTHING;
```

---

## MIGRATION 6: Create call_templates Table

```sql
-- Migration 6: Call Templates
-- Purpose: Store reusable call scripts

CREATE TABLE IF NOT EXISTS call_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  style TEXT,  -- "PAS", "AIDA", "Direct", "Consultative"
  
  -- Template content (supports {{variable}} substitution)
  opening_line TEXT NOT NULL,
  body_lines TEXT[] NOT NULL,  -- Array of lines
  closing_line TEXT NOT NULL,
  cta_line TEXT,
  
  -- Available variables
  available_variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Usage tracking
  is_default BOOLEAN DEFAULT FALSE,
  usage_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT workspace_fk FOREIGN KEY(workspace_id) 
    REFERENCES users_settings(workspace_id) ON DELETE CASCADE,
  CONSTRAINT unique_name_per_workspace UNIQUE(workspace_id, name),
  CONSTRAINT one_default_per_workspace 
    UNIQUE(workspace_id) WHERE is_default = TRUE
);

CREATE INDEX idx_call_templates_workspace ON call_templates(workspace_id);

-- Insert default template
INSERT INTO call_templates (
  workspace_id, name, style, is_default,
  opening_line, body_lines, closing_line, cta_line,
  available_variables
) VALUES (
  'default',
  'Default: PAS (Problem-Agitate-Solve)',
  'PAS',
  TRUE,
  'Hi {{first_name}}, got 30 seconds?',
  ARRAY[
    'Saw {{company}} is expanding SBA lending',
    'We close {{product_close_days}} day SBA 504s with {{product_ltv}}% LTV',
    'This helps your clients get better rates and terms'
  ]::TEXT[],
  'Worth a quick coffee to discuss?',
  'When works best - Thursday or Friday?',
  ARRAY['first_name', 'company', 'product_ltv', 'product_close_days']::TEXT[]
) ON CONFLICT DO NOTHING;
```

---

## MIGRATION 7: Add Denormalized Columns to contact_intelligence

```sql
-- Migration 7: Add Denormalized Columns
-- Purpose: Add indexed columns for fast querying

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_company_name TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_company_revenue BIGINT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_company_employees INT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_company_industry TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_company_growth_yoy FLOAT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_person_title TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_person_background TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_last_enriched_at TIMESTAMP;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  enrichment_data_quality_score INT;

-- Kernel denormalized columns
ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  kernel_who_persona TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  kernel_who_influence TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  kernel_when_urgency TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  kernel_when_timing_signal TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  kernel_what_hook TEXT;

-- Content denormalized columns
ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  best_call_variant_number INT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  email_subject TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  email_body_preview TEXT;

-- Product/ICP columns
ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  assigned_product TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  icp_id UUID;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  icp_match_score INT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  product_match JSONB;

-- Campaign columns
ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  campaign_id UUID;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  email_send_id TEXT;

-- Prediction breakdown
ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  prediction_factors JSONB;

-- Metadata
ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  source TEXT;

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  tags TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE contact_intelligence ADD COLUMN IF NOT EXISTS
  notes TEXT;

-- Add foreign key for ICP
ALTER TABLE contact_intelligence ADD CONSTRAINT
  icp_fk FOREIGN KEY(icp_id) REFERENCES ideal_client_profiles(id) ON DELETE SET NULL;

-- Add foreign key for campaign
ALTER TABLE contact_intelligence ADD CONSTRAINT
  campaign_fk FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
```

---

## MIGRATION 8: Add Indexes for Performance

```sql
-- Migration 8: Add Performance Indexes

-- Enrichment queries
CREATE INDEX IF NOT EXISTS idx_enrichment_company_name 
  ON contact_intelligence(workspace_id, enrichment_company_name);

CREATE INDEX IF NOT EXISTS idx_enrichment_company_revenue 
  ON contact_intelligence(workspace_id, enrichment_company_revenue);

CREATE INDEX IF NOT EXISTS idx_enrichment_company_industry 
  ON contact_intelligence(workspace_id, enrichment_company_industry);

-- Kernel queries
CREATE INDEX IF NOT EXISTS idx_kernel_who_persona 
  ON contact_intelligence(workspace_id, kernel_who_persona);

CREATE INDEX IF NOT EXISTS idx_kernel_when_urgency 
  ON contact_intelligence(workspace_id, kernel_when_urgency);

-- Product/ICP queries
CREATE INDEX IF NOT EXISTS idx_assigned_product 
  ON contact_intelligence(workspace_id, assigned_product);

CREATE INDEX IF NOT EXISTS idx_icp_match 
  ON contact_intelligence(workspace_id, icp_match_score DESC);

-- Engagement queries
CREATE INDEX IF NOT EXISTS idx_engagement_tracking 
  ON contact_intelligence(workspace_id, sent_at, opened_at, replied_at);

-- Prediction queries
CREATE INDEX IF NOT EXISTS idx_success_probability_desc 
  ON contact_intelligence(workspace_id, success_probability DESC);

-- Campaign queries
CREATE INDEX IF NOT EXISTS idx_campaign_id 
  ON contact_intelligence(workspace_id, campaign_id);

-- Tag-based queries
CREATE INDEX IF NOT EXISTS idx_tags 
  ON contact_intelligence USING GIN(tags);

-- Source tracking
CREATE INDEX IF NOT EXISTS idx_source 
  ON contact_intelligence(workspace_id, source);
```

---

## MIGRATION 9: Backfill Denormalized Data

```sql
-- Migration 9: Backfill Denormalized Columns
-- For contacts already in enriched+ stage

UPDATE contact_intelligence SET
  enrichment_company_name = COALESCE(
    enrichment_data->'company'->>'name',
    enrichment_company_name
  ),
  enrichment_company_revenue = COALESCE(
    (enrichment_data->'company'->>'revenue')::bigint,
    enrichment_company_revenue
  ),
  enrichment_company_employees = COALESCE(
    (enrichment_data->'company'->>'employees')::int,
    enrichment_company_employees
  ),
  enrichment_company_industry = COALESCE(
    enrichment_data->'company'->>'industry',
    enrichment_company_industry
  ),
  enrichment_company_growth_yoy = COALESCE(
    (enrichment_data->'company'->>'growth_yoy')::float,
    enrichment_company_growth_yoy
  ),
  enrichment_person_title = COALESCE(
    enrichment_data->>'title',
    enrichment_person_title
  ),
  enrichment_person_background = COALESCE(
    enrichment_data->>'background',
    enrichment_person_background
  ),
  kernel_who_persona = COALESCE(
    kernel_analysis->'who'->>'persona_type',
    kernel_who_persona
  ),
  kernel_when_urgency = COALESCE(
    kernel_analysis->'when'->>'urgency_level',
    kernel_when_urgency
  ),
  kernel_what_hook = COALESCE(
    kernel_analysis->'what'->>'opening_hook',
    kernel_what_hook
  ),
  email_subject = COALESCE(
    email_content->>'subject',
    email_subject
  ),
  email_body_preview = COALESCE(
    SUBSTRING(email_content->>'body', 1, 200),
    email_body_preview
  )
WHERE enrichment_data IS NOT NULL
  OR kernel_analysis IS NOT NULL
  OR email_content IS NOT NULL;

-- Set data quality score
UPDATE contact_intelligence SET
  enrichment_data_quality_score = (
    CASE
      WHEN enrichment_company_name IS NOT NULL THEN 20
      ELSE 0
    END +
    CASE
      WHEN enrichment_company_revenue IS NOT NULL THEN 20
      ELSE 0
    END +
    CASE
      WHEN enrichment_company_industry IS NOT NULL THEN 15
      ELSE 0
    END +
    CASE
      WHEN enrichment_person_title IS NOT NULL THEN 15
      ELSE 0
    END +
    CASE
      WHEN enrichment_person_background IS NOT NULL THEN 15
      ELSE 0
    END +
    CASE
      WHEN enrichment_company_growth_yoy IS NOT NULL THEN 15
      ELSE 0
    END
  )
WHERE enrichment_data IS NOT NULL;
```

---

## MIGRATION 10: Create Views for Common Queries

```sql
-- Migration 10: Create Views for Common Queries

-- View: Contacts ready to send (with all needed data)
CREATE OR REPLACE VIEW v_ready_to_send AS
SELECT 
  ci.id,
  ci.workspace_id,
  ci.contact_id,
  ci.success_probability,
  ci.recommended_action,
  ci.enrichment_company_name,
  ci.enrichment_company_industry,
  ci.kernel_who_persona,
  ci.kernel_when_urgency,
  ci.email_subject,
  ci.assigned_product,
  ct.body_template as best_call_template,
  et.subject_template as email_template,
  ci.created_at,
  ci.updated_at
FROM contact_intelligence ci
LEFT JOIN call_templates ct ON ci.best_call_variant_number = 1
LEFT JOIN email_templates et ON ci.assigned_product = 'sba_504'
WHERE ci.stage = 'ready_to_send'
ORDER BY ci.success_probability DESC;

-- View: Pipeline status by stage
CREATE OR REPLACE VIEW v_pipeline_status AS
SELECT 
  workspace_id,
  stage,
  COUNT(*) as count,
  ROUND(AVG(success_probability)::numeric, 2) as avg_success_prob,
  MIN(created_at) as oldest_contact,
  MAX(updated_at) as newest_update
FROM contact_intelligence
GROUP BY workspace_id, stage;

-- View: Engagement metrics
CREATE OR REPLACE VIEW v_engagement_metrics AS
SELECT 
  workspace_id,
  campaign_id,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened,
  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as total_clicked,
  COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as total_replied,
  ROUND(100.0 * COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) / COUNT(*), 2) as open_rate,
  ROUND(100.0 * COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) / COUNT(*), 2) as click_rate,
  ROUND(100.0 * COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) / COUNT(*), 2) as reply_rate
FROM contact_intelligence
WHERE sent_at IS NOT NULL
GROUP BY workspace_id, campaign_id;
```

---

## HOW TO RUN THESE MIGRATIONS

### Option 1: In Supabase UI (Recommended for Testing)

1. Go to https://app.supabase.com
2. Project → SQL Editor
3. Click "New query"
4. Paste each migration
5. Click "Run"

### Option 2: With SQL File (Production)

```bash
# Save as migrations/001_create_schema.sql
# Then run via Supabase CLI
supabase migration up

# Or manually via psql
psql $DATABASE_URL < migrations/001_create_schema.sql
```

### Recommended Order

Run migrations in this order:
1. Migration 1: users_settings
2. Migration 2: ideal_client_profiles
3. Migration 3: contact_field_definitions
4. Migration 4: campaigns
5. Migration 5: email_templates
6. Migration 6: call_templates
7. Migration 7: Add denormalized columns
8. Migration 8: Add indexes
9. Migration 9: Backfill data
10. Migration 10: Create views

---

## VERIFICATION

### Check that tables were created

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should return:
-- campaigns
-- call_templates
-- contact_field_definitions
-- contact_intelligence
-- email_templates
-- ideal_client_profiles
-- intelligence_events
-- pipeline_metrics
-- users_settings
```

### Check denormalized columns exist

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contact_intelligence'
  AND column_name LIKE 'enrichment_%'
ORDER BY column_name;
```

### Check indexes were created

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'contact_intelligence'
ORDER BY indexname;
```

---

## NEXT STEPS

After running these migrations:

1. ✅ Update orchestrator_phase_1.py to fill in denormalized columns
2. ✅ Create Python helper classes (FieldAccessor, variable substitution)
3. ✅ Build Phase 2 dashboard queries
4. ✅ Test with sample data

See `VARIABLES_AND_FIELDS_ARCHITECTURE.md` for implementation details.
