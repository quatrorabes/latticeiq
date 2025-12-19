// Enrich Button Component
import { useState } from 'react';
import { useEnrichment } from '../hooks/useEnrichment';
import { Sparkles, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface EnrichButtonProps {
  contactId: number;
  enrichmentStatus?: string;
  onEnrichComplete?: () => void;
  variant?: 'button' | 'icon';
}

export function EnrichButton({ 
  contactId, 
  enrichmentStatus,
  onEnrichComplete,
  variant = 'button' 
}: EnrichButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const { enrich, isEnriching, status, error, reset } = useEnrichment({
    onComplete: () => {
      onEnrichComplete?.();
    },
    onError: (err) => {
      console.error('Enrichment error:', err);
    }
  });
  
  const handleClick = () => {
    if (isEnriching) return;
    if (error) {
      reset();
    }
    enrich(contactId);
  };
  
  const isAlreadyEnriched = enrichmentStatus === 'completed';
  
  // Progress indicator
  const domainsCompleted = status?.domains_completed?.length ?? 0;
  const totalDomains = 5;
  const progressPercent = isEnriching ? Math.round((domainsCompleted / totalDomains) * 100) : 0;
  
  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={isEnriching}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={isAlreadyEnriched ? 'Re-enrich contact' : 'Enrich contact'}
      >
        {isEnriching ? (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        ) : isAlreadyEnriched ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : error ? (
          <XCircle className="w-5 h-5 text-red-500" />
        ) : (
          <Sparkles className="w-5 h-5 text-purple-500" />
        )}
        
        {showTooltip && isEnriching && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap">
            {status?.domains_completed?.join(', ') || 'Starting...'}
          </div>
        )}
      </button>
    );
  }
  
  return (
    <button
      onClick={handleClick}
      disabled={isEnriching}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
        ${isEnriching 
          ? 'bg-blue-100 text-blue-700 cursor-wait' 
          : isAlreadyEnriched
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : error
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-purple-600 text-white hover:bg-purple-700'
        }
        disabled:opacity-70
      `}
    >
      {isEnriching ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Enriching... {progressPercent}%</span>
        </>
      ) : isAlreadyEnriched ? (
        <>
          <CheckCircle className="w-4 h-4" />
          <span>Re-Enrich</span>
        </>
      ) : error ? (
        <>
          <XCircle className="w-4 h-4" />
          <span>Retry</span>
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          <span>Enrich</span>
        </>
      )}
    </button>
  );
}
