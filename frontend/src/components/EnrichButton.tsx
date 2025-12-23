// frontend/src/components/EnrichButton.tsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { EnrichmentResponse } from "../services/enrichmentService";

const API_URL = import.meta.env.VITE_API_URL || "https://latticeiq-backend.onrender.com";

interface EnrichButtonProps {
  contactId: string | number;
  currentStatus?: string;
  onEnrichmentComplete?: () => void;
  onComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  variant?: "table" | "modal";
}

export default function EnrichButton({
  contactId,
  currentStatus: _currentStatus,
  onEnrichmentComplete,
  onComplete,
  size = 'md',
  showLabel = true,
  variant = "table"
}: EnrichButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suppress unused var warning
  void _currentStatus;

  const handleEnrich = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // ✅ FIXED: Use correct endpoint /api/v3/enrichment/enrich
      const response = await fetch(`${API_URL}/api/v3/enrichment/enrich`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contact_id: Number(contactId) }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Enrichment failed (${response.status})`);
      }

      const result: EnrichmentResponse = await response.json();
      console.log("✅ Enrichment started:", result);

      // Poll for completion
      pollEnrichmentStatus(Number(contactId));

      if (onComplete) onComplete();
      if (onEnrichmentComplete) onEnrichmentComplete();
    } catch (err) {
      console.error("Enrich error:", err);
      setError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setLoading(false);
    }
  };

  const pollEnrichmentStatus = async (contactId: number, attempts = 0) => {
    if (attempts > 100) {
      setError("Enrichment timeout (5+ minutes)");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(
        `${API_URL}/api/v3/enrichment/enrich/${contactId}/status`,
        {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) return;

      const status = await response.json();
      console.log(`📊 Enrichment status (attempt ${attempts + 1}):`, status);

      if (status.status === "completed") {
        setError(null);
        if (onComplete) onComplete();
        if (onEnrichmentComplete) onEnrichmentComplete();
      } else if (status.status === "failed") {
        setError(status.error || "Enrichment failed on backend");
      } else {
        // Still processing, poll again in 2-3 seconds
        setTimeout(() => pollEnrichmentStatus(contactId, attempts + 1), 2000);
      }
    } catch (err) {
      console.error("Poll error:", err);
      // Retry on network error
      setTimeout(() => pollEnrichmentStatus(contactId, attempts + 1), 3000);
    }
  };

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

  // Compact table variant
  if (variant === "table") {
    return (
      <div className="flex items-center gap-2">
        {loading ? (
          <>
            <span className="text-xs text-gray-400">enriching...</span>
            <div className="animate-spin w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full" />
          </>
        ) : (
          <>
            <button
              onClick={handleEnrich}
              disabled={loading}
              className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white text-xs rounded transition"
              title="Start enrichment"
            >
              {showLabel ? "Enrich" : "✨"}
            </button>
          </>
        )}
        {error && (
          <span className="text-red-500 text-xs" title={error}>
            ⚠️
          </span>
        )}
      </div>
    );
  }

  // Full modal variant
  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <>
          <div className="flex items-center gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
            <span className="text-cyan-400">Enriching contact...</span>
          </div>
          <p className="text-xs text-gray-400">This typically takes 30-60 seconds</p>
        </>
      ) : (
        <button
          onClick={handleEnrich}
          disabled={loading}
          className={`px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white rounded-lg transition font-medium ${sizeClass}`}
        >
          ✨ Enrich Contact
        </button>
      )}
      {error && (
        <div className="flex items-center justify-between gap-2 bg-red-900 bg-opacity-30 border border-red-600 rounded p-3">
          <span className="text-red-400 text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-300 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}