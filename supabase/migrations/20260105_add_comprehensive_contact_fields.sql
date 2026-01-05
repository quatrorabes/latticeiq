-- Migration: Add comprehensive contact fields for CRM imports
-- Date: 2026-01-05
-- Description: Extends contacts table to support all fields from HubSpot, Salesforce, Pipedrive, and CSV imports

-- ============================================================================
-- NEW COLUMNS FOR CONTACTS TABLE
-- ============================================================================

-- Professional Information
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS employee_count TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS annual_revenue BIGINT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_size TEXT;

-- Location Fields (expanded)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS location TEXT;  -- Combined/formatted address

-- Social & Web
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS twitter_handle TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website TEXT;

-- Additional Phone
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mobile_phone TEXT;

-- Lead/Sales Information
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS buying_role TEXT;

-- HubSpot Specific
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS hubspot_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS hubspot_persona TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS page_views INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS site_visits INTEGER;

-- Salesforce Specific
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS salesforce_id TEXT;

-- Pipedrive Specific
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pipedrive_id TEXT;

-- Activity Tracking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- INDEXES FOR COMMON QUERIES
-- ============================================================================

-- CRM ID lookups
CREATE INDEX IF NOT EXISTS idx_contacts_hubspot_id ON contacts(hubspot_id) WHERE hubspot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_salesforce_id ON contacts(salesforce_id) WHERE salesforce_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_pipedrive_id ON contacts(pipedrive_id) WHERE pipedrive_id IS NOT NULL;

-- Location-based queries
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_state ON contacts(state) WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts(country) WHERE country IS NOT NULL;

-- Company/industry queries
CREATE INDEX IF NOT EXISTS idx_contacts_industry ON contacts(industry) WHERE industry IS NOT NULL;

-- Lead status queries
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status ON contacts(lead_status) WHERE lead_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_stage ON contacts(lifecycle_stage) WHERE lifecycle_stage IS NOT NULL;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN contacts.department IS 'Contact department within company';
COMMENT ON COLUMN contacts.industry IS 'Company industry (from CRM account data)';
COMMENT ON COLUMN contacts.employee_count IS 'Company employee count/range';
COMMENT ON COLUMN contacts.annual_revenue IS 'Company annual revenue in USD';
COMMENT ON COLUMN contacts.street_address IS 'Street address line';
COMMENT ON COLUMN contacts.city IS 'City name';
COMMENT ON COLUMN contacts.state IS 'State/province/region';
COMMENT ON COLUMN contacts.postal_code IS 'ZIP/postal code';
COMMENT ON COLUMN contacts.country IS 'Country name or code';
COMMENT ON COLUMN contacts.location IS 'Combined formatted address for display';
COMMENT ON COLUMN contacts.twitter_handle IS 'Twitter/X handle without @';
COMMENT ON COLUMN contacts.website IS 'Personal or company website URL';
COMMENT ON COLUMN contacts.mobile_phone IS 'Mobile/cell phone number';
COMMENT ON COLUMN contacts.lead_source IS 'How the lead was acquired';
COMMENT ON COLUMN contacts.lead_status IS 'Current lead status';
COMMENT ON COLUMN contacts.lifecycle_stage IS 'Contact lifecycle stage (subscriber, lead, customer, etc.)';
COMMENT ON COLUMN contacts.buying_role IS 'Role in purchasing decisions';
COMMENT ON COLUMN contacts.hubspot_id IS 'HubSpot contact record ID';
COMMENT ON COLUMN contacts.hubspot_persona IS 'HubSpot persona assignment';
COMMENT ON COLUMN contacts.page_views IS 'Website page views from HubSpot tracking';
COMMENT ON COLUMN contacts.site_visits IS 'Website visit count from HubSpot tracking';
COMMENT ON COLUMN contacts.salesforce_id IS 'Salesforce contact record ID';
COMMENT ON COLUMN contacts.pipedrive_id IS 'Pipedrive person record ID';
COMMENT ON COLUMN contacts.last_activity_at IS 'Last activity/engagement timestamp';
COMMENT ON COLUMN contacts.birthday IS 'Contact birthday';
COMMENT ON COLUMN contacts.notes IS 'Free-form notes about the contact';
