// frontend/src/components/EnrichButton.tsx
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "https://latticeiq-backend.onrender.com";

interface EnrichButtonProps {
  contactId: string;
  onComplete?: () => void;
  variant?: "table" | "modal";
}

export default function EnrichButton({ contactId, onComplete, variant = "table" }: EnrichButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnrich = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Call quick-enrich endpoint (synchronous, ~5-10 sec)
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

      // Success - trigger callback to reload contacts
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error("Enrich error:", err);
      setError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setLoading(false);
    }
  };

  // Table row button (compact)
  if (variant === "table") {
    return (
      <button
        onClick={handleEnrich}
        disabled={loading}
        className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded transition-colors"
      >
        {loading ? "Enriching..." : "Enrich"}
      </button>
    );
  }

  // Modal button (full width)
  return (
    <div className="w-full">
      <button
        onClick={handleEnrich}
        disabled={loading}
        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors"
      >
        {loading ? "Enriching..." : "Enrich Contact"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
