// frontend/src/components/EnrichButton.tsx
// FULL WORKING ENRICH BUTTON - Calls V3 enrichment, shows loading, refreshes on complete

import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { contactsService } from '../services/contactsService';

interface EnrichButtonProps {
  contactId: number;
  enrichmentStatus?: string | null;
  onEnrichComplete?: () => void;
  variant?: 'icon' | 'primary';
}

export const EnrichButton: React.FC<EnrichButtonProps> = ({
  contactId,
  enrichmentStatus,
  onEnrichComplete,
  variant = 'icon',
}) => {
  const [enriching, setEnriching] = useState(false);

  const handleEnrich = async () => {
    if (enrichmentStatus === 'completed' || enrichmentStatus === 'processing') {
      alert('Already enriched or in progress');
      return;
    }

    setEnriching(true);
    try {
      await contactsService.enrichContact(contactId);
      onEnrichComplete?.();
      alert('Enrichment complete! Click contact to view results.');
    } catch (error) {
      console.error('Enrichment failed:', error);
      alert('Enrichment failed. Check console.');
    } finally {
      setEnriching(false);
    }
  };

  const isDisabled = enriching || enrichmentStatus === 'completed';

  if (variant === 'icon') {
    return (
      <button
        onClick={handleEnrich}
        disabled={isDisabled}
        className="p-1 rounded hover:bg-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title={enriching ? 'Enriching...' : 'Enrich with AI'}
      >
        {enriching ? (
          <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
        ) : (
          <Zap className="w-4 h-4 text-purple-400" />
        )}
      </button>
    );
  }

  // Primary variant for toolbar buttons
  return (
    <button
      onClick={handleEnrich}
      disabled={isDisabled}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
    >
      {enriching ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Enriching...
        </>
      ) : (
        <>
          <Zap className="w-4 h-4" />
          Enrich
        </>
      )}
    </button>
  );
};
