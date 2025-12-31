"use client";

import { useState } from "react";
import { crmApi } from "@/api/crm";

type Step = "upload" | "preview" | "mapping" | "results";

export default function CRMPage() {
  const [step, setStep] = useState<Step>("upload");
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<any>(null);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError("");

      const text = await file.text();
      setCsvContent(text);
      setFileName(file.name);

      // Preview CSV
      const previewData = await crmApi.previewCSV(text, file.name);
      setPreview(previewData);

      // Auto-map fields
      const mapping: Record<string, string> = {};
      previewData.detected_fields?.forEach((field: any) => {
        mapping[field.column_name] = field.detected_type;
      });
      setFieldMapping(mapping);

      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  // Handle field mapping change
  const handleMappingChange = (column: string, dbField: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [column]: dbField,
    }));
  };

  // Execute import
  const handleImport = async () => {
    try {
      setLoading(true);
      setError("");

      const importResults = await crmApi.executeImport(csvContent, fieldMapping);
      setResults(importResults);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">CSV Import</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
            id="csv-input"
          />
          <label htmlFor="csv-input" className="cursor-pointer">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-lg font-semibold mb-2">Drop your CSV file here</p>
            <p className="text-gray-600">or click to browse</p>
          </label>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && preview && (
        <div>
          <h2 className="text-xl font-bold mb-4">Preview: {fileName}</h2>
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <p className="mb-2">Total rows: <strong>{preview.total_rows}</strong></p>
            <p>Columns: <strong>{preview.headers?.join(", ")}</strong></p>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  {preview.headers?.map((header: string) => (
                    <th key={header} className="border border-gray-300 p-2 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample_data?.map((row: any, idx: number) => (
                  <tr key={idx}>
                    {preview.headers?.map((header: string) => (
                      <td key={header} className="border border-gray-300 p-2">
                        {row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep("mapping")}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next: Map Fields
            </button>
            <button
              onClick={() => setStep("upload")}
              className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-100"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step: Mapping */}
      {step === "mapping" && preview && (
        <div>
          <h2 className="text-xl font-bold mb-4">Map CSV Columns</h2>

          <div className="space-y-4 mb-6">
            {preview.detected_fields?.map((field: any) => (
              <div key={field.column_name} className="p-4 border border-gray-200 rounded">
                <label className="block text-sm font-semibold mb-2">
                  {field.column_name}
                  <span className="text-gray-600 ml-2">
                    ({field.detected_type} - {(field.confidence * 100).toFixed(0)}%)
                  </span>
                </label>
                <input
                  type="text"
                  value={fieldMapping[field.column_name] || ""}
                  onChange={(e) => handleMappingChange(field.column_name, e.target.value)}
                  placeholder="Enter database field"
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Importing..." : "Execute Import"}
            </button>
            <button
              onClick={() => setStep("preview")}
              className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-100"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step: Results */}
      {step === "results" && results && (
        <div>
          <h2 className="text-xl font-bold mb-4">Import Complete ✅</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-green-50 rounded">
              <p className="text-gray-600">Successful</p>
              <p className="text-3xl font-bold text-green-600">{results.successful_imports}</p>
            </div>
            <div className="p-4 bg-red-50 rounded">
              <p className="text-gray-600">Failed</p>
              <p className="text-3xl font-bold text-red-600">{results.failed_imports}</p>
            </div>
          </div>

          <button
            onClick={() => {
              setStep("upload");
              setCsvContent("");
              setPreview(null);
              setFieldMapping({});
              setResults(null);
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
