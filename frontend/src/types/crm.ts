"""
All frontend files for CRM Import System
Copy these to frontend/src/ directory structure
"""

# ============================================================================
# frontend/src/types/crm.ts
# ============================================================================

export interface DetectedField {
  field_name: string;
  detected_type: "text" | "email" | "phone" | "number" | "date" | "url" | "unknown";
  confidence: number;
  sample_values: string[];
}

export interface CSVPreviewResponse {
  file_name: string;
  total_rows: number;
  preview_rows: Record<string, string>[];
  column_headers: string[];
  detected_fields: Record<string, DetectedField>;
  has_errors: boolean;
  error_message?: string;
}

export interface FieldMapping {
  id: string;
  mapping_name: string;
  csv_columns: string[];
  db_field_mapping: Record<string, string>;
  is_default: boolean;
  created_at: string;
}

export interface ImportFilter {
  min_score?: number;
  max_score?: number;
  score_type?: "mdcp" | "bant" | "spice";
  enrichment_status?: "completed" | "pending";
  company_pattern?: string;
  exclude_duplicates: boolean;
}

export interface ImportContactsRequest {
  csv_data: string;
  field_mapping: Record<string, string>;
  import_filters?: ImportFilter;
  auto_enrich: boolean;
  auto_score: boolean;
  save_mapping_as?: string;
}

export interface ImportResult {
  contact_id: string;
  first_name: string;
  email: string;
  company?: string;
  status: "success" | "error";
  error?: string;
}

export interface ImportJobResponse {
  import_job_id: string;
  total_processed: number;
  imported: number;
  duplicates_skipped: number;
  failed: number;
  errors: Record<number, string>;
  import_time_seconds: number;
  status: "pending" | "processing" | "completed" | "failed";
  created_contacts: ImportResult[];
}

export interface ImportHistoryEntry {
  id: string;
  file_name: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  duplicates_skipped: number;
  status: "pending" | "processing" | "completed" | "failed";
  source_provider: string;
  import_filters?: Record<string, any>;
  created_at: string;
  completed_at?: string;
}

// ============================================================================
// frontend/src/api/crm.ts
// ============================================================================

import { supabase } from "@/lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_URL;

export async function previewCSV(file: File): Promise<CSVPreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const { data: session } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${API_BASE}/api/v3/crm/preview-csv`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to preview CSV");
  }

  return response.json();
}

export async function detectFields(
  csvColumns: string[],
  sampleRows: Record<string, string>[]
): Promise<{
  suggested_mapping: Record<string, string>;
  unmapped_columns: string[];
  confidence: number;
}> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${API_BASE}/api/v3/crm/detect-fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      csv_columns: csvColumns,
      sample_rows: sampleRows,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to detect fields");
  }

  return response.json();
}

export async function saveMapping(
  mappingName: string,
  csvColumns: string[],
  dbFieldMapping: Record<string, string>,
  isDefault: boolean = false
): Promise<FieldMapping> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${API_BASE}/api/v3/crm/save-mapping`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mapping_name: mappingName,
      csv_columns: csvColumns,
      db_field_mapping: dbFieldMapping,
      is_default: isDefault,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save mapping");
  }

  return response.json();
}

export async function getSavedMappings(): Promise<{ mappings: FieldMapping[] }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${API_BASE}/api/v3/crm/saved-mappings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch saved mappings");
  }

  return response.json();
}

export async function validateImport(
  csvData: string,
  fieldMapping: Record<string, string>
): Promise<{
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: Record<number, string>;
  is_valid: boolean;
}> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${API_BASE}/api/v3/crm/validate-import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      csv_data: csvData,
      field_mapping: fieldMapping,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to validate import");
  }

  return response.json();
}

export async function importContacts(
  csvData: string,
  fieldMapping: Record<string, string>,
  filters?: ImportFilter,
  autoEnrich: boolean = false,
  autoScore: boolean = false,
  saveMappingAs?: string
): Promise<ImportJobResponse> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${API_BASE}/api/v3/crm/import-contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      csv_data: csvData,
      field_mapping: fieldMapping,
      import_filters: filters,
      auto_enrich: autoEnrich,
      auto_score: autoScore,
      save_mapping_as: saveMappingAs,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to import contacts");
  }

  return response.json();
}

export async function getImportHistory(
  limit: number = 50,
  offset: number = 0
): Promise<{
  imports: ImportHistoryEntry[];
  total: number;
}> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(
    `${API_BASE}/api/v3/crm/import-history?limit=${limit}&offset=${offset}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch import history");
  }

  return response.json();
}

// ============================================================================
// frontend/src/pages/CRMImportPage.tsx
// ============================================================================

import React, { useState } from "react";
import { CSVUploader } from "@/components/CRM/CSVUploader";
import { FieldMapper } from "@/components/CRM/FieldMapper";
import { PreviewTable } from "@/components/CRM/PreviewTable";
import { FilterPanel } from "@/components/CRM/FilterPanel";
import { ImportProgress } from "@/components/CRM/ImportProgress";
import { ImportHistory } from "@/components/CRM/ImportHistory";
import {
  CSVPreviewResponse,
  ImportFilter,
  ImportJobResponse,
} from "@/types/crm";
import * as crmApi from "@/api/crm";

type Step = "upload" | "mapping" | "filters" | "confirm" | "importing" | "complete";

export const CRMImportPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [csvData, setCSVData] = useState<CSVPreviewResponse | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<ImportFilter>({
    exclude_duplicates: true,
  });
  const [importResult, setImportResult] = useState<ImportJobResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCSVUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const preview = await crmApi.previewCSV(file);
      setCSVData(preview);

      // Auto-detect fields
      const detected = await crmApi.detectFields(
        preview.column_headers,
        preview.preview_rows
      );
      setFieldMapping(detected.suggested_mapping);

      setCurrentStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMappingComplete = (mapping: Record<string, string>) => {
    setFieldMapping(mapping);
    setCurrentStep("filters");
  };

  const handleFilterComplete = (appliedFilters: ImportFilter) => {
    setFilters(appliedFilters);
    setCurrentStep("confirm");
  };

  const handleConfirmImport = async () => {
    if (!csvData) return;

    setLoading(true);
    setError(null);
    setCurrentStep("importing");

    try {
      const result = await crmApi.importContacts(
        btoa(JSON.stringify(csvData.preview_rows)), // Convert to base64
        fieldMapping,
        filters
      );
      setImportResult(result);
      setCurrentStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setCurrentStep("confirm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Import Contacts</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex justify-between mb-4">
          {["upload", "mapping", "filters", "confirm", "complete"].map(
            (step, idx) => (
              <div
                key={step}
                className={`flex-1 h-2 mx-1 rounded ${
                  ["upload", "mapping", "filters", "confirm", "importing", "complete"]
                    .indexOf(currentStep) >= idx
                    ? "bg-blue-500"
                    : "bg-gray-200"
                }`}
              />
            )
          )}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === "upload" && (
        <CSVUploader onUpload={handleCSVUpload} loading={loading} />
      )}

      {currentStep === "mapping" && csvData && (
        <div className="space-y-6">
          <FieldMapper
            csvColumns={csvData.column_headers}
            detectedFields={csvData.detected_fields}
            currentMapping={fieldMapping}
            onMappingChange={setFieldMapping}
            onComplete={handleMappingComplete}
            previewRows={csvData.preview_rows}
          />
        </div>
      )}

      {currentStep === "filters" && csvData && (
        <div className="space-y-6">
          <PreviewTable rows={csvData.preview_rows} />
          <FilterPanel
            totalRows={csvData.total_rows}
            onFiltersChange={setFilters}
            onContinue={handleFilterComplete}
          />
        </div>
      )}

      {currentStep === "confirm" && csvData && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Import Summary</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt>Total Rows:</dt>
                <dd className="font-mono">{csvData.total_rows}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Field Mapping:</dt>
                <dd className="font-mono">
                  {Object.keys(fieldMapping).length} fields mapped
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Exclude Duplicates:</dt>
                <dd>{filters.exclude_duplicates ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setCurrentStep("filters")}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Importing..." : "Confirm Import"}
            </button>
          </div>
        </div>
      )}

      {currentStep === "importing" && <ImportProgress />}

      {currentStep === "complete" && importResult && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-green-800 mb-4">
              Import Complete
            </h2>
            <dl className="space-y-2 text-green-700">
              <div className="flex justify-between">
                <dt>Imported:</dt>
                <dd className="font-mono font-bold">{importResult.imported}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Duplicates Skipped:</dt>
                <dd className="font-mono">{importResult.duplicates_skipped}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Failed:</dt>
                <dd className="font-mono">{importResult.failed}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Time:</dt>
                <dd className="font-mono">
                  {importResult.import_time_seconds.toFixed(2)}s
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                setCurrentStep("upload");
                setCSVData(null);
                setFieldMapping({});
                setImportResult(null);
              }}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Import Another File
            </button>
            <button
              onClick={() => (window.location.href = "/contacts")}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              View Contacts
            </button>
          </div>
        </div>
      )}

      {/* Import History Section */}
      <div className="mt-12 pt-8 border-t">
        <h2 className="text-2xl font-bold mb-6">Import History</h2>
        <ImportHistory />
      </div>
    </div>
  );
};

export default CRMImportPage;

// ============================================================================
// frontend/src/components/CRM/CSVUploader.tsx
// ============================================================================

import React, { useRef } from "react";

interface CSVUploaderProps {
  onUpload: (file: File) => void;
  loading?: boolean;
}

export const CSVUploader: React.FC<CSVUploaderProps> = ({
  onUpload,
  loading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("border-blue-500", "bg-blue-50");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("border-blue-500", "bg-blue-50");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === "text/csv") {
      onUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition"
        onClick={() => fileInputRef.current?.click()}
      >
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M32 4v12M28 8l4-4 4 4" strokeWidth={2} />
        </svg>

        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Upload CSV File
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Drag and drop your CSV file here, or click to select
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          disabled={loading}
          className="hidden"
        />

        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Select File"}
        </button>
      </div>

      <div className="text-sm text-gray-600">
        <p className="font-medium mb-2">Accepted file format:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>CSV files (comma-separated values)</li>
          <li>Maximum 50MB</li>
          <li>First row should contain column headers</li>
          <li>Supports up to 100,000 rows</li>
        </ul>
      </div>
    </div>
  );
};

// ============================================================================
// (Remaining components: FieldMapper, PreviewTable, FilterPanel, ImportProgress, ImportHistory)
// Are available in the complete source code package
// ============================================================================
