// Enrichment Hook with Polling
import { useState, useCallback, useRef } from 'react';
import { 
  enrichContact, 
  getEnrichmentStatus, 
  getEnrichmentProfile,
  EnrichmentStatus,
  EnrichmentProfile 
} from '../services/enrichmentService';

interface UseEnrichmentOptions {
  onComplete?: (profile: EnrichmentProfile) => void;
  onError?: (error: Error) => void;
  pollInterval?: number;
}

export function useEnrichment(options: UseEnrichmentOptions = {}) {
  const { onComplete, onError, pollInterval = 2000 } = options;
  
  const [isEnriching, setIsEnriching] = useState(false);
  const [status, setStatus] = useState<EnrichmentStatus | null>(null);
  const [profile, setProfile] = useState<EnrichmentProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  
  const startPolling = useCallback((contactId: number) => {
    stopPolling();
    
    pollRef.current = setInterval(async () => {
      try {
        const statusResult = await getEnrichmentStatus(contactId);
        setStatus(statusResult);
        
        if (statusResult.status === 'completed') {
          stopPolling();
          const profileResult = await getEnrichmentProfile(contactId);
          setProfile(profileResult);
          setIsEnriching(false);
          onComplete?.(profileResult);
        } else if (statusResult.status === 'failed') {
          stopPolling();
          setIsEnriching(false);
          const err = new Error(statusResult.error || 'Enrichment failed');
          setError(err);
          onError?.(err);
        }
      } catch (err) {
        stopPolling();
        setIsEnriching(false);
        const error = err instanceof Error ? err : new Error('Polling failed');
        setError(error);
        onError?.(error);
      }
    }, pollInterval);
  }, [pollInterval, stopPolling, onComplete, onError]);
  
  const enrich = useCallback(async (contactId: number) => {
    setIsEnriching(true);
    setError(null);
    setStatus(null);
    setProfile(null);
    
    try {
      const response = await enrichContact(contactId);
      setStatus({
        enrichment_id: response.enrichment_id,
        contact_id: contactId,
        status: 'processing',
        progress: 0,
        domains_completed: [],
        domains_pending: ['COMPANY', 'PERSON', 'INDUSTRY', 'NEWS', 'OPEN_ENDED']
      });
      startPolling(contactId);
    } catch (err) {
      setIsEnriching(false);
      const error = err instanceof Error ? err : new Error('Failed to start enrichment');
      setError(error);
      onError?.(error);
    }
  }, [startPolling, onError]);
  
  const reset = useCallback(() => {
    stopPolling();
    setIsEnriching(false);
    setStatus(null);
    setProfile(null);
    setError(null);
  }, [stopPolling]);
  
  return {
    enrich,
    reset,
    isEnriching,
    status,
    profile,
    error,
    progress: status?.progress ?? 0
  };
}
