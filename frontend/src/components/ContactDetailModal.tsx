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
        <div className="px-6 py-5 border-b border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white">{getDisplayName()}</h2>
              <p className="text-gray-400 mt-1">
                {contact.title ? `${contact.title} at ` : ''}{contact.company || 'Unknown Company'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none p-1"
            >
              ×
            </button>
          </div>
          
          {/* Quick Stats Row */}
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <span className="text-gray-400 text-xs uppercase tracking-wide">APEX</span>
              <p className={`text-xl font-bold ${getScoreColor(contact.apex_score)}`}>
                {contact.apex_score ?? '—'}
              </p>
            </div>
            <div className="bg-gray-800 px-4 py-2 rounded-lg">
              <span className="text-gray-400 text-xs uppercase tracking-wide">Status</span>
              <p className={`text-sm font-medium px-2 py-1 rounded mt-1 inline-block ${getStatusBadge(enrichmentStatus)}`}>
                {enrichmentStatus}
              </p>
            </div>
          </div>
          
          {/* Action Buttons Row */}
          <div className="flex items-center gap-3">
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
                  <span>Enriching...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Enrich Contact</span>
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
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download TXT</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-700 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-3 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'profile'
                  ? 'text-indigo-400 border-indigo-400'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`py-3 font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'raw'
                  ? 'text-indigo-400 border-indigo-400'
                  : 'text-gray-400 border-transparent hover:text-white'
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
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact Info</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <span className="text-gray-500">Email</span>
                    <p className="text-white mt-0.5">{contact.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone</span>
                    <p className="text-white mt-0.5">{contact.phone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">LinkedIn</span>
                    <p className="mt-0.5">
                      {contact.linkedin_url ? (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                          View Profile
                        </a>
                      ) : <span className="text-white">—</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Website</span>
                    <p className="text-white mt-0.5">{contact.website || '—'}</p>
                  </div>
                </div>
              </section>
              
              {/* Enrichment Data */}
              {synthesized && (
                <>
                  {synthesized.summary && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Executive Summary</h3>
                      <p className="text-gray-300 leading-relaxed">{synthesized.summary as string}</p>
                    </section>
                  )}
                  
                  {synthesized.opening_line && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Opening Line</h3>
                      <p className="text-indigo-300 italic leading-relaxed">"{synthesized.opening_line as string}"</p>
                    </section>
                  )}
                  
                  {synthesized.hook && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Hook</h3>
                      <p className="text-gray-300 leading-relaxed">{synthesized.hook as string}</p>
                    </section>
                  )}
                  
                  {synthesized.talking_points && Array.isArray(synthesized.talking_points) && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Talking Points</h3>
                      <ul className="space-y-2">
                        {(synthesized.talking_points as string[]).map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300">
                            <span className="text-indigo-400 mt-1">- </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  
                  {synthesized.bant && (
                    <section>
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">BANT Analysis</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(synthesized.bant as Record<string, string>).map(([key, value]) => (
                          <div key={key} className="bg-gray-800/50 p-3 rounded-lg">
                            <span className="text-gray-400 text-xs uppercase tracking-wide">{key}</span>
                            <p className="text-white text-sm mt-1">{value}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
              
              {!synthesized && enrichmentStatus === 'pending' && (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-2">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-gray-400">No enrichment data yet.</p>
                  <p className="text-gray-500 text-sm mt-1">Click "Enrich Contact" to get started.</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Raw Enrichment Data</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(contact.enrichment_data, null, 2));
                  }}
                  className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              </div>
              <pre className="bg-gray-800 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto font-mono">
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
