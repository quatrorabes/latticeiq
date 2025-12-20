// frontend/src/components/EnrichButton.tsx
import { useState } from "react";
import { Sparkles, Loader2, CheckCircle, XCircle } from "lucide-react";
import contactsService from "../services/contactsService";
import type { EnrichmentStatus } from "../services/contactsService";

interface EnrichButtonProps {
  contactId: string;
  currentStatus: string;
  onEnrichmentComplete?: () => void;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

type ButtonState = "idle" | "loading" | "polling" | "success" | "error";

export default function EnrichButton({
  contactId,
  currentStatus,
  onEnrichmentComplete,
  size = "md",
  showLabel = true,
}: EnrichButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const isEnriched = currentStatus === "completed";
  const isProcessing =
    currentStatus === "processing" || state === "loading" || state === "polling";

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const iconSize = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  const handleEnrich = async () => {
    if (isProcessing || isEnriched) return;

    setState("loading");
    setError("");
    setProgress(0);
    setStage("Starting enrichment...");

    try {
      await contactsService.enrichContact(contactId);

      setState("polling");
      setStage("Gathering data...");

      await contactsService.pollEnrichmentUntilComplete(
        contactId,
        (status: EnrichmentStatus) => {
          setProgress(status.progress ?? 0);
          setStage(status.current_stage || "Processing...");
        },
        60,
        2000
      );

      setState("success");
      setStage("Enrichment complete!");

      onEnrichmentComplete?.();

      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Enrichment failed");

      setTimeout(() => {
        setState("idle");
        setError("");
      }, 3000);
    }
  };

  if (isEnriched && state === "idle") {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-1.5 rounded-md font-medium bg-green-500/20 text-green-400 cursor-default ${sizeClasses[size]}`}
        title="Already enriched"
      >
        <CheckCircle size={iconSize[size]} />
        {showLabel && "Enriched"}
      </button>
    );
  }

  if (state === "error") {
    return (
      <button
        onClick={handleEnrich}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors ${sizeClasses[size]}`}
        title={error}
      >
        <XCircle size={iconSize[size]} />
        {showLabel && "Retry"}
      </button>
    );
  }

  if (state === "success") {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-1.5 rounded-md font-medium bg-green-500/20 text-green-400 cursor-default ${sizeClasses[size]}`}
      >
        <CheckCircle size={iconSize[size]} />
        {showLabel && "Done!"}
      </button>
    );
  }

  if (state === "loading" || state === "polling") {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-1.5 rounded-md font-medium bg-purple-500/20 text-purple-400 cursor-wait ${sizeClasses[size]}`}
        title={stage}
      >
        <Loader2 size={iconSize[size]} className="animate-spin" />
        {showLabel && (
          <span className="truncate max-w-[100px]">
            {progress > 0 ? `${Math.round(progress * 100)}%` : stage}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleEnrich}
      className={`inline-flex items-center gap-1.5 rounded-md font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors ${sizeClasses[size]}`}
      title="Enrich this contact"
    >
      <Sparkles size={iconSize[size]} />
      {showLabel && "Enrich"}
    </button>
  );
}
