-- Migration: Add Scoring Columns to Contacts Table
-- Date: December 31, 2025
-- Author: Chris Rabenold
-- Purpose: Enable persistence of MDCP, BANT, SPICE scoring data

-- Add scoring columns to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS overall_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS mdcp_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS mdcp_tier VARCHAR(10),
ADD COLUMN IF NOT EXISTS bant_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS bant_tier VARCHAR(10),
ADD COLUMN IF NOT EXISTS spice_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS spice_tier VARCHAR(10);

-- Refresh Postgrest schema cache
NOTIFY pgrst, 'reload schema';

-- Verification query (optional - run after migration)
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'contacts' 
-- AND column_name LIKE '%score%' OR column_name LIKE '%tier%';
