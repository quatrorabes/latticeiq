// frontend/src/components/EnrichButton.tsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "https://latticeiq-backend.onrender.com";

interface EnrichButtonProps {
  contactId: string;
  currentStatus?: string;
  onEnrichmentComplete?: () => void;
  onComplete?: () => void;
  size?: string;
  showLabel?: boolean;
  variant?: "table" | "modal";
}

export default function EnrichButton({ 
  contactId, 
  currentStatus: _currentStatus,
  onEnrichmentComplete,
  onComplete, 
  size,
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

  const isSmall = size === "sm";

  if (variant === "table" || isSmall) {
    return (
      <button
        onClick={handleEnrich}
        disabled={loading}
        className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded transition-colors"
      >
        {loading ? "..." : (showLabel ? "Enrich" : "⚡")}
      </button>
    );
  }

  return (
    <div className="w-full">
      <button
        onClick={handleEnrich}
        disabled={loading}
        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors"
      >
        {loading ? "Enriching..." : "Enrich Contact"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
