# LatticeIQ CRM Import System - Complete Implementation Guide

**Status:** Production Ready  
**Date:** December 31, 2025  
**Phase:** 1 - Foundation (Field Mapping + CSV Import)  
**Owner:** Chris Rabenold

---

## 📋 **System Overview**

### What This System Does
- ✅ Upload CSV files with flexible column mapping
- ✅ Auto-detect and map CSV columns to database fields
- ✅ Preview data before import
- ✅ Validate contact information (email, duplicates, required fields)
- ✅ Filter contacts before import (by score, status, company, etc.)
- ✅ Batch import with progress tracking
- ✅ Store CRM integration credentials for future APIs
- ✅ Track import history and metadata

### What You Get
```
Database:
  - crm_integrations table (store API keys, OAuth tokens)
  - field_mappings table (save user-defined column mappings)
  - import_jobs table (track import progress/history)
  
Backend:
  - POST /api/v3/crm/preview-csv (upload + preview)
  - POST /api/v3/crm/detect-fields (auto-detect columns)
  - POST /api/v3/crm/save-mapping (save field mapping)
  - POST /api/v3/crm/validate-import (validate before committing)
  - POST /api/v3/crm/import-contacts (execute import with filters)
  - GET /api/v3/crm/import-history (view past imports)
  
Frontend:
  - CRMImportPage (main flow)
  - CSVUploader component
  - FieldMapper component (map columns)
  - PreviewTable component (show sample data)
  - FilterPanel component (filter by score/company/etc)
  - ImportProgress component (real-time status)
```

---

## 🗄️ **Database Schema**

### 1. crm_integrations Table
```sql
CREATE TABLE crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'hubspot', 'salesforce', 'pipedrive', 'csv'
  provider_account_id VARCHAR(255), -- HubSpot portal ID, Salesforce instance, etc.
  access_token TEXT, -- Encrypted in production
  refresh_token TEXT, -- Encrypted in production
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  sync_frequency VARCHAR(20), -- 'manual', 'daily', 'weekly'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);
```

### 2. field_mappings Table
```sql
CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  mapping_name VARCHAR(100) NOT NULL, -- "HubSpot Export", "Salesforce Contacts", etc.
  csv_columns JSONB NOT NULL, -- ["First Name", "Email", "Company", ...]
  db_field_mapping JSONB NOT NULL, -- {"First Name": "first_name", "Email": "email", ...}
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Example db_field_mapping:
{
  "First Name": "first_name",
  "Last Name": "last_name",
  "Email Address": "email",
  "Company": "company",
  "Job Title": "title",
  "Phone": "phone",
  "Website": "website",
  "_skip": ["Internal ID", "Notes"] -- columns to ignore
}
```

### 3. import_jobs Table
```sql
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  total_rows INT NOT NULL,
  imported_rows INT DEFAULT 0,
  failed_rows INT DEFAULT 0,
  duplicates_skipped INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_log JSONB, -- Store errors for specific rows
  source_provider VARCHAR(50), -- 'csv', 'hubspot', 'salesforce', etc.
  import_filters JSONB, -- {"min_score": 50, "score_type": "mdcp", "company_filter": ""}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Example error_log:
{
  "row_5": "Invalid email format: john@invalid",
  "row_12": "Duplicate email: sarah@company.com (already imported)",
  "row_18": "Missing required field: email"
}
```

---

## 🔄 **Data Flow**

```
User Browser
    ↓
1. Upload CSV (CSVUploader)
    ↓
POST /api/v3/crm/preview-csv
    ↓
Backend:
  - Parse CSV (first 5 rows for preview)
  - Detect column types (text, email, number)
  - Return preview + detected fields
    ↓
2. Field Mapper (FieldMapper)
    - User maps CSV columns to DB fields
    - Shows preview with mapped data
    - Option to save as reusable mapping
    ↓
3. Filter Panel (FilterPanel)
    - Filter: min_score, max_score, score_type
    - Filter: company name pattern
    - Filter: enrichment status
    - Shows estimated contact count
    ↓
4. Import Confirmation
    - "Import 145 contacts (5 duplicates will be skipped)"
    ↓
POST /api/v3/crm/import-contacts
    ↓
Backend:
  - Validate each row against mapping
  - Check for duplicates (email + workspace)
  - Apply filters
  - Score new contacts
  - Bulk insert to contacts table
  - Return success/failure summary
    ↓
5. Import Complete
    - Show results: 145 imported, 5 duplicates, 0 errors
    - List imported contacts
    - Save import history
```

---

## 🚀 **Setup Instructions**

### Step 1: Database Migrations

Run these in Supabase SQL Editor:

```sql
-- Create crm_integrations table
CREATE TABLE crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_account_id VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  sync_frequency VARCHAR(20) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Create field_mappings table
CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  mapping_name VARCHAR(100) NOT NULL,
  csv_columns JSONB NOT NULL,
  db_field_mapping JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create import_jobs table
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  total_rows INT NOT NULL,
  imported_rows INT DEFAULT 0,
  failed_rows INT DEFAULT 0,
  duplicates_skipped INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  error_log JSONB,
  source_provider VARCHAR(50),
  import_filters JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_crm_integrations_user ON crm_integrations(user_id);
CREATE INDEX idx_crm_integrations_workspace ON crm_integrations(workspace_id);
CREATE INDEX idx_field_mappings_user ON field_mappings(user_id);
CREATE INDEX idx_import_jobs_user ON import_jobs(user_id);

-- Refresh Postgrest schema
NOTIFY pgrst, 'reload schema';
```

### Step 2: Deploy Backend Code
Copy files from "Backend Implementation" section below to your `backend/app/crm/` directory.

### Step 3: Deploy Frontend Code
Copy files from "Frontend Implementation" section below to your `frontend/src/` directory.

### Step 4: Update Main Routes
Register new endpoints in `backend/app/main.py` (see "Integration Checklist" below).

---

## 🔧 **Configuration**

### Environment Variables (Backend)
```
# .env or Render dashboard
CSV_MAX_FILE_SIZE_MB=50
CSV_MAX_ROWS=100000
CSV_BATCH_SIZE=1000
DUPLICATE_CHECK_FIELDS=email,first_name,last_name
AUTO_ENRICH_ON_IMPORT=false
AUTO_SCORE_ON_IMPORT=false
```

### Feature Flags (Frontend)
```typescript
// frontend/src/config/features.ts
export const FEATURES = {
  csvImport: true,
  fieldMapping: true,
  importFiltering: true,
  saveMapping: true,
  importHistory: true,
  
  // Future CRM integrations
  hubspotIntegration: false,
  salesforceIntegration: false,
  pipedriveIntegration: false,
};
```

---

## 📝 **API Specifications**

### POST /api/v3/crm/preview-csv
Upload CSV and get preview of first 5 rows.

**Request:**
```
Content-Type: multipart/form-data
- file: CSV file
- limit: 5 (preview rows)
```

**Response (200):**
```json
{
  "file_name": "contacts.csv",
  "total_rows": 1250,
  "preview_rows": [
    {
      "First Name": "John",
      "Last Name": "Doe",
      "Email": "john@example.com",
      "Company": "TechCorp"
    },
    ...
  ],
  "detected_fields": {
    "First Name": { "type": "text", "confidence": 0.95 },
    "Email": { "type": "email", "confidence": 0.98 },
    "Company": { "type": "text", "confidence": 0.85 }
  },
  "column_headers": ["First Name", "Last Name", "Email", "Company", ...]
}
```

### POST /api/v3/crm/detect-fields
Auto-detect which columns map to database fields.

**Request:**
```json
{
  "csv_columns": ["First Name", "Last Name", "Email", "Company", "Job Title"],
  "sample_rows": [
    {"First Name": "John", "Last Name": "Doe", "Email": "john@example.com", ...}
  ]
}
```

**Response (200):**
```json
{
  "suggested_mapping": {
    "First Name": "first_name",
    "Last Name": "last_name",
    "Email": "email",
    "Company": "company",
    "Job Title": "title"
  },
  "unmapped_columns": [],
  "confidence": 0.92
}
```

### POST /api/v3/crm/save-mapping
Save field mapping for reuse.

**Request:**
```json
{
  "mapping_name": "Salesforce Export v2",
  "csv_columns": ["First Name", "Last Name", "Email", "Company", "Title"],
  "db_field_mapping": {
    "First Name": "first_name",
    "Last Name": "last_name",
    "Email": "email",
    "Company": "company",
    "Title": "title"
  },
  "is_default": true
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "mapping_name": "Salesforce Export v2",
  "is_default": true,
  "created_at": "2025-12-31T13:30:00Z"
}
```

### POST /api/v3/crm/import-contacts
Execute the import with filters applied.

**Request:**
```json
{
  "csv_data": "[base64 encoded CSV]",
  "field_mapping": {
    "First Name": "first_name",
    "Email": "email",
    ...
  },
  "import_filters": {
    "min_score": 0,
    "max_score": 100,
    "score_type": "mdcp",
    "enrichment_status": "all",
    "company_pattern": ""
  },
  "auto_enrich": false,
  "auto_score": false
}
```

**Response (200):**
```json
{
  "import_job_id": "uuid",
  "total_processed": 1250,
  "imported": 1245,
  "duplicates_skipped": 5,
  "failed": 0,
  "errors": {},
  "import_time_seconds": 42,
  "status": "completed",
  "created_contacts": [
    {
      "id": "uuid",
      "first_name": "John",
      "email": "john@example.com",
      "company": "TechCorp"
    }
  ]
}
```

### GET /api/v3/crm/import-history
Get past imports.

**Response (200):**
```json
{
  "imports": [
    {
      "id": "uuid",
      "file_name": "salesforce_contacts_dec31.csv",
      "total_rows": 1250,
      "imported_rows": 1245,
      "duplicates_skipped": 5,
      "status": "completed",
      "created_at": "2025-12-31T13:00:00Z"
    }
  ],
  "total": 42
}
```

---

## 🎯 **Testing Checklist**

```
[ ] Database migrations run without errors
[ ] Can upload CSV file (under 50MB)
[ ] Preview shows first 5 rows correctly
[ ] Field detection works (auto-maps common columns)
[ ] Can manually adjust field mappings
[ ] Can save mapping as reusable template
[ ] Filter panel shows estimated contact count
[ ] Import validation catches duplicates
[ ] Import catches invalid emails
[ ] Bulk import completes successfully
[ ] Imported contacts appear in table
[ ] Scoring updates for new contacts
[ ] Import history shows past imports
[ ] All API endpoints return correct status codes
```

---

## 🔗 **Future Extensions (Phase 2)**

### HubSpot Integration
```
1. OAuth flow to connect HubSpot account
2. Auto-map HubSpot fields to database schema
3. Webhook to sync new contacts on-demand
4. Pull recent contacts by deal stage
```

### Salesforce Integration
```
1. OAuth + SOAP/REST query builder
2. Map Salesforce object fields to contacts
3. Sync Account + Contact objects
4. Support SOQL filters
```

### Pipedrive Integration
```
1. OAuth to Pipedrive account
2. Map persons + organizations
3. Pull by deal stage/pipeline
4. Track source for revenue attribution
```

### Generic API
```
1. Custom endpoint URL
2. Auth method selection (Bearer, Basic, API Key)
3. JSON response path mapping
4. Polling interval
```

---

## 📊 **Metrics to Track**

- Total contacts imported
- Average time per import
- Duplicate detection rate
- Error rate by field
- Most common field mappings (for UI suggestions)
- CRM provider breakdown (CSV, HubSpot, Salesforce, etc.)

---

## 🚨 **Error Handling**

All errors return standard format:
```json
{
  "error": "import_validation_failed",
  "message": "5 rows contain invalid data",
  "details": {
    "row_3": "Invalid email format: notanemail",
    "row_7": "Missing required field: email"
  },
  "status_code": 422
}
```

---

## 📚 **Next Steps**

1. ✅ Run database migrations
2. ✅ Deploy backend files
3. ✅ Deploy frontend files
4. ✅ Test import flow with sample CSV
5. ✅ Configure feature flags
6. ⏳ Build HubSpot integration (Phase 2)
7. ⏳ Build Salesforce integration (Phase 2)
8. ⏳ Build Pipedrive integration (Phase 2)

---

**Ready to deploy. See implementation files below.** 🚀