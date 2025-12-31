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
