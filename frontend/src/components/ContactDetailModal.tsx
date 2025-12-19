// frontend/src/components/ContactDetailModal.tsx
import { useState, useEffect } from 'react';
import type { Contact } from '../types/contact';
import { supabase } from '../lib/supabaseClient';

interface ContactDetailModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrichComplete?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL;

export default function ContactDetailModal({ 
  contact, 
  isOpen, 
  onClose,
  onEnrichComplete 
}: ContactDetailModalProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentStatus, setEnrichmentStatus] = useState<string>('not_started');
  const [rawData, setRawData] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'raw'>('info');

  // Reset and load data when contact changes
  useEffect(() => {
    if (contact) {
      setEnrichmentStatus(contact.enrichment_status || 'not_started');
      setError(null);
      
      // Parse and display existing enrichment data
      if (contact.enrichment_data) {
        try {
          const data = typeof contact.enrichment_data === 'string' 
            ? JSON.parse(contact.enrichment_data) 
            : contact.enrichment_data;
          setRawData(JSON.stringify(data, null, 2));
        } catch (e) {
          setRawData(String(contact.enrichment_data));
        }
      } else {
        setRawData('');
      }
    }
  }, [contact]);

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  };

  const handleEnrich = async () => {
    if (!contact || isEnriching) return;
    
    setIsEnriching(true);
    setError(null);
    setEnrichmentStatus('pending');
    
    try {
      const headers = await getAuthHeaders();
      
      // Trigger enrichment
      const triggerResponse = await fetch(`${API_URL}/api/v3/enrich`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ contact_id: contact.id }),
      });
      
      if (!triggerResponse.ok) {
        const errData = await triggerResponse.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to start enrichment');
      }
      
      setEnrichmentStatus('enriching');
      
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await fetch(`${API_URL}/api/v3/enrichment-status/${contact.id}`, {
          method: 'GET',
          headers,
        });
        
        if (!statusResponse.ok) {
          attempts++;
          continue;
        }
        
        const statusData = await statusResponse.json();
        setEnrichmentStatus(statusData.enrichment_status);
        
        if (statusData.enrichment_data) {
          setRawData(JSON.stringify(statusData.enrichment_data, null, 2));
        }
        
        if (statusData.enrichment_status === 'completed' || statusData.enrichment_status === 'failed') {
          if (statusData.enrichment_status === 'completed' && onEnrichComplete) {
            onEnrichComplete();
          }
          break;
        }
        
        attempts++;
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrichment failed');
      setEnrichmentStatus('failed');
    } finally {
      setIsEnriching(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(rawData);
  };

  const downloadAsText = () => {
    if (!contact) return;
    const blob = new Blob([rawData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contact.first_name}_${contact.last_name}_enrichment.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Don't render if not open or no contact
  if (!isOpen || !contact) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {contact.first_name} {contact.last_name}
            </h2>
            <p className="text-gray-400">
              {contact.title && `${contact.title} at `}{contact.company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'info' 
                ? 'text-blue-500 border-b-2 border-blue-500' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Contact Info
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'raw' 
                ? 'text-blue-500 border-b-2 border-blue-500' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Raw Data
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div>
              {/* Contact Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="text-gray-500 text-sm">Email</label>
                  <p className="text-white">{contact.email || '—'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="text-gray-500 text-sm">Phone</label>
                  <p className="text-white">{contact.phone || '—'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="text-gray-500 text-sm">Company</label>
                  <p className="text-white">{contact.company || '—'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <label className="text-gray-500 text-sm">Title</label>
                  <p className="text-white">{contact.title || '—'}</p>
                </div>
              </div>

              {/* Scores */}
              {contact.apex_score !== null && contact.apex_score !== undefined && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Scores</h3>
                  <div className="grid grid-cols-5 gap-3">
                    <ScoreCard label="APEX" score={contact.apex_score} tier={contact.match_tier} isPrimary />
                    <ScoreCard label="MDCP" score={contact.mdcp_score} />
                    <ScoreCard label="RSS" score={contact.rss_score} />
                    <ScoreCard label="BANT" score={contact.bant_total_score} />
                    <ScoreCard label="SPICE" score={contact.spice_total_score} />
                  </div>
                </div>
              )}

              {/* Enrichment Controls */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Enrichment</h3>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm px-3 py-1 rounded ${
                      enrichmentStatus === 'completed' ? 'bg-green-900/50 text-green-400' :
                      enrichmentStatus === 'enriching' || enrichmentStatus === 'pending' ? 'bg-blue-900/50 text-blue-400' :
                      enrichmentStatus === 'failed' ? 'bg-red-900/50 text-red-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {enrichmentStatus.replace('_', ' ')}
                    </span>
                    <button
                      onClick={handleEnrich}
                      disabled={isEnriching}
                      className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                        isEnriching 
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      ✨ {isEnriching ? 'Enriching...' : enrichmentStatus === 'completed' ? 'Re-Enrich' : 'Enrich'}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
                    <p className="text-red-400">{error}</p>
                  </div>
                )}

                {/* Loading */}
                {(enrichmentStatus === 'pending' || enrichmentStatus === 'enriching') && (
                  <div className="bg-gray-800 rounded-lg p-8 text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-400">
                      {enrichmentStatus === 'pending' ? 'Starting enrichment...' : 'Gathering intelligence...'}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">This typically takes 15-30 seconds</p>
                  </div>
                )}

                {/* Not Started */}
                {enrichmentStatus === 'not_started' && !isEnriching && (
                  <div className="bg-gray-800 rounded-lg p-8 text-center">
                    <div className="text-4xl mb-4">✨</div>
                    <p className="text-gray-400">Click "Enrich" to gather AI-powered sales intelligence</p>
                  </div>
                )}

                {/* Completed - Show preview */}
                {enrichmentStatus === 'completed' && rawData && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-green-400 mb-2">✓ Enrichment completed</p>
                    <p className="text-gray-400 text-sm">Switch to "Raw Data" tab to view full results</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === 'raw' && (
            <div>
              {/* Actions */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={copyToClipboard}
                  disabled={!rawData}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors"
                >
                  📋 Copy to Clipboard
                </button>
                <button
                  onClick={downloadAsText}
                  disabled={!rawData}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors"
                >
                  💾 Download as .txt
                </button>
              </div>

              {/* Raw Data Display */}
              {rawData ? (
                <pre className="bg-gray-950 border border-gray-700 rounded-lg p-4 overflow-x-auto text-sm text-gray-300 whitespace-pre-wrap font-mono max-h-[500px] overflow-y-auto">
                  {rawData}
                </pre>
              ) : (
                <div className="bg-gray-800 rounded-lg p-8 text-center">
                  <p className="text-gray-400">No enrichment data available yet.</p>
                  <p className="text-gray-500 text-sm mt-2">Run enrichment from the Contact Info tab to see data here.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Score Card Component
function ScoreCard({ 
  label, 
  score, 
  tier,
  isPrimary = false 
}: { 
  label: string; 
  score?: number | null; 
  tier?: string | null;
  isPrimary?: boolean;
}) {
  const displayScore = score ?? '—';
  
  const getTierColor = () => {
    if (!tier && !isPrimary) return 'bg-gray-800';
    if (!tier) return 'bg-gray-700';
    switch (tier.toUpperCase()) {
      case 'HIGH': return 'bg-green-600';
      case 'MEDIUM': return 'bg-yellow-600';
      case 'LOW': return 'bg-red-600';
      default: return 'bg-gray-700';
    }
  };
  
  return (
    <div className={`rounded-lg p-3 text-center ${isPrimary ? getTierColor() : 'bg-gray-800'}`}>
      <p className="text-gray-400 text-xs uppercase">{label}</p>
      <p className="text-2xl font-bold text-white">{displayScore}</p>
      {isPrimary && tier && (
        <p className="text-xs text-white/80 uppercase">{tier}</p>
      )}
    </div>
  );
}
