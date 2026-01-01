import { supabase } from "@/lib/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const crmApi = {
  async previewCSV(csvContent: string, fileName: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/crm/preview-csv`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` }),
      },
      body: JSON.stringify({
        csv_content: csvContent,
        file_name: fileName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to preview CSV");
    }

    return response.json();
  },

  async detectFields(csvContent: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/crm/detect-fields`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` }),
      },
      body: JSON.stringify({ csv_content: csvContent }),
    });

    if (!response.ok) throw new Error("Failed to detect fields");
    return response.json();
  },

  async validateImport(csvContent: string, fieldMapping: Record<string, string>) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/crm/validate-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` }),
      },
      body: JSON.stringify({
        csv_content: csvContent,
        field_mapping: fieldMapping,
      }),
    });

    if (!response.ok) throw new Error("Failed to validate import");
    return response.json();
  },

  async executeImport(csvContent: string, fieldMapping: Record<string, string>) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/crm/import-contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` }),
      },
      body: JSON.stringify({
        csv_content: csvContent,
        field_mapping: fieldMapping,
        skip_duplicates: true,
      }),
    });

    if (!response.ok) throw new Error("Failed to execute import");
    return response.json();
  },

  async getImportHistory() {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(`${API_URL}/api/v3/crm/import-history`, {
      method: "GET",
      headers: {
        ...(token && { "Authorization": `Bearer ${token}` }),
      },
    });

    if (!response.ok) throw new Error("Failed to get import history");
    return response.json();
  },
};
