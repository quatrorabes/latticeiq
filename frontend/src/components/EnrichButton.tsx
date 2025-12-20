// frontend/src/components/EnrichButton.tsx

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "https://latticeiq-backend.onrender.com";

interface EnrichButtonProps {
  contactId: string;
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

      const response = await fetch(`${API_URL}/api/quick-enrich/${contactId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Enrichment failed (${response.status})`);
      }

      if (onComplete) onComplete();
      if (onEnrichmentComplete) onEnrichmentComplete();
    } catch (err) {
      console.error("Enrich error:", err);
      setError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setLoading(false);
    }
  };

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';

  // Compact table variant
  if (variant === "table") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleEnrich}
          disabled={loading}
          className={`btn btn-primary ${sizeClass}`}
          title={loading ? "Enriching..." : "Enrich contact"}
        >
          {loading ? (
            <>
              <span className="spinner spinner-sm mr-2" />
              {showLabel ? "..." : ""}
            </>
          ) : (
            <>
              <span>⚡</span>
              {showLabel ? "Enrich" : ""}
            </>
          )}
        </button>
        {error && (
          <span className="text-xs text-error" title={error}>
            Error
          </span>
        )}
      </div>
    );
  }

  // Full modal variant
  return (
    <div className="space-y-3">
      <button
        onClick={handleEnrich}
        disabled={loading}
        className={`btn btn-primary w-full ${sizeClass}`}
      >
        {loading ? (
          <>
            <span className="spinner spinner-sm mr-2" />
            Enriching contact...
          </>
        ) : (
          <>
            <span>✨</span>
            Enrich Contact
          </>
        )}
      </button>
      {error && (
        <div className="p-3 bg-error bg-opacity-10 border border-error border-opacity-30 rounded-base text-error text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-error hover:text-error-dark text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
