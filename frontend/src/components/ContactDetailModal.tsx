// frontend/src/components/ContactDetailModal.tsx
import { useState } from 'react';
import type { Contact } from '../types/contact';
import { enrichContact, downloadEnrichmentTxt } from '../services/contactsService';

interface ContactDetailModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrichComplete?: () => void;
}

export default function ContactDetailModal({
  contact,
  isOpen,
  onClose,
  onEnrichComplete
}: ContactDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'raw'>('profile');
  const [isEnriching, setIsEnriching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !contact) return null;

  const handleEnrich = async () => {
    if (!contact.id) return;
    
    setIsEnriching(true);
    setError(null);
    
    try {
      const result = await enrichContact(contact.id, true);
      console.log('Enrichment complete:', result);
      
      if (onEnrichComplete) {
        onEnrichComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleDownloadTxt = async () => {
    if (!contact.id) return;
    
    setIsDownloading(true);
    setError(null);
    
    try {
      await downloadEnrichmentTxt(contact.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const getDisplayName = () => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    }
    return contact.email;
  };

  const getScoreColor = (score?: number | null) => {
    if (!score) return 'text-gray-400';
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusBadge = (status?: string | null) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-600 text-gray-200',
      processing: 'bg-blue-600 text-blue-200',
      completed: 'bg-green-600 text-green-200',
      failed: 'bg-red-600 text-red-200'
    };
    return styles[status || 'pending'] || styles.pending;
  };

  const enrichmentData = contact.enrichment_data as Record<string, unknown> | undefined;
  const synthesized = enrichmentData?.synthesized as Record<string, unknown> | undefined;
  const enrichmentStatus = contact.enrichment_status || 'pending';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white">{getDisplayName()}</h2>
              <p className="text-gray-400 mt-1">
                {contact.title ? `${contact.title} at ` : ''}{contact.company || 'Unknown Company'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-4 mt-4">
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <span className="text-gray-400 text-sm">APEX</span>
              <p className={`text-2xl font-bold ${getScoreColor(contact.apex_score)}`}>
                {contact.apex_score ?? '—'}
              </p>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <span className="text-gray-400 text-sm">Status</span>
              <p className={`text-sm font-medium px-2 py-1 rounded mt-1 ${getStatusBadge(enrichmentStatus)}`}>
                {enrichmentStatus}
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleEnrich}
              disabled={isEnriching || enrichmentStatus === 'processing'}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                isEnriching || enrichmentStatus === 'processing'
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isEnriching ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Enriching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Enrich Contact
                </>
              )}
            </button>
            
            {enrichmentStatus === 'completed' && (
              <button
                onClick={handleDownloadTxt}
                disabled={isDownloading}
                className="px-4 py-2 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-2 transition-colors"
              >
                {isDownloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download TXT
                  </>
                )}
              </button>
            )}
          </div>
          
          {error && (
            <div className="mt-3 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'raw'
                  ? 'text-indigo-400 border-b-2 border-indigo-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Raw Data
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Contact Info */}
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">Contact Info</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Email:</span>
                    <p className="text-white">{contact.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Phone:</span>
                    <p className="text-white">{contact.phone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">LinkedIn:</span>
                    <p className="text-white">
                      {contact.linkedin_url ? (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                          View Profile
                        </a>
                      ) : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Website:</span>
                    <p className="text-white">{contact.website || '—'}</p>
                  </div>
                </div>
              </section>
              
              {/* Enrichment Data (if available) */}
              {synthesized && (
                <>
                  {/* Summary */}
                  {synthesized.summary && (
                    <section>
                      <h3 className="text-lg font-semibold text-white mb-3">Executive Summary</h3>
                      <p className="text-gray-300">{synthesized.summary as string}</p>
                    </section>
                  )}
                  
                  {/* Opening Line */}
                  {synthesized.opening_line && (
                    <section>
                      <h3 className="text-lg font-semibold text-white mb-3">Opening Line</h3>
                      <p className="text-indigo-300 italic">"{synthesized.opening_line as string}"</p>
                    </section>
                  )}
                  
                  {/* Hook */}
                  {synthesized.hook && (
                    <section>
                      <h3 className="text-lg font-semibold text-white mb-3">Hook</h3>
                      <p className="text-gray-300">{synthesized.hook as string}</p>
                    </section>
                  )}
                  
                  {/* Talking Points */}
                  {synthesized.talking_points && Array.isArray(synthesized.talking_points) && (
                    <section>
                      <h3 className="text-lg font-semibold text-white mb-3">Talking Points</h3>
                      <ul className="list-disc list-inside text-gray-300 space-y-2">
                        {(synthesized.talking_points as string[]).map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  
                  {/* BANT */}
                  {synthesized.bant && (
                    <section>
                      <h3 className="text-lg font-semibold text-white mb-3">BANT Analysis</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {Object.entries(synthesized.bant as Record<string, string>).map(([key, value]) => (
                          <div key={key} className="bg-gray-800 p-3 rounded-lg">
                            <span className="text-gray-400 capitalize">{key}:</span>
                            <p className="text-white mt-1">{value}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
              
              {!synthesized && enrichmentStatus === 'pending' && (
                <div className="text-center py-8">
                  <p className="text-gray-400">No enrichment data yet. Click "Enrich Contact" to get started.</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-white">Raw Enrichment Data</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(contact.enrichment_data, null, 2));
                  }}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  Copy to Clipboard
                </button>
              </div>
              <pre className="bg-gray-800 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">
                {contact.enrichment_data
                  ? JSON.stringify(contact.enrichment_data, null, 2)
                  : 'No enrichment data available'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
