import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { Contact } from '../types/contact';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

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
  onEnrichComplete,
}: ContactDetailModalProps) {
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !contact) return null;

  const handleEnrich = async () => {
    if (!contact?.id) return;

    setEnriching(true);
    setError(null);
    
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${API_URL}/api/v3/enrich/${contact.id}`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Enrichment failed');
      }

      const result = await response.json();
      console.log('✅ Enrichment result:', result);

      if (onEnrichComplete) {
        onEnrichComplete();
      }
      
      // Close and refresh
      onClose();
    } catch (err: any) {
      console.error('❌ Enrichment error:', err);
      setError(err.message || 'Enrichment failed. Please try again.');
    } finally {
      setEnriching(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-900 text-green-300';
      case 'processing':
        return 'bg-blue-900 text-blue-300';
      case 'failed':
        return 'bg-red-900 text-red-300';
      case 'pending':
        return 'bg-yellow-900 text-yellow-300';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  // Get enrichment data with flexible field names
  const enrichment = contact.enrichment_data || {};
  const summary = enrichment.summary || enrichment.company_overview;
  const talkingPoints = enrichment.talking_points || enrichment.talkingpoints || [];
  const personaType = enrichment.persona_type || enrichment.personatype;
  const vertical = enrichment.vertical;
  const companySize = enrichment.company_size;
  const inferredTitle = enrichment.inferred_title || enrichment.inferredtitle;
  const inferredSeniority = enrichment.inferred_seniority;
  const recentNews = enrichment.recent_news;
  const recommendedApproach = enrichment.recommended_approach;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {contact.first_name} {contact.last_name}
            </h2>
            <p className="text-gray-400 mt-1">{contact.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(contact.enrichment_status)}`}>
              {contact.enrichment_status || 'Not Enriched'}
            </span>
            {contact.enriched_at && (
              <span className="text-xs text-gray-500">
                Enriched: {new Date(contact.enriched_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Basic Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Company" value={contact.company} />
            <DetailRow label="Title" value={contact.job_title || contact.title || inferredTitle} />
            <DetailRow label="Phone" value={contact.phone} />
            <DetailRow label="Website" value={contact.website} isLink />
            <DetailRow label="LinkedIn" value={contact.linkedin_url} isLink />
          </div>

          {/* Enrichment Data */}
          {contact.enrichment_status === 'completed' && enrichment ? (
            <div className="space-y-5 border-t border-gray-700 pt-5">
              <h3 className="text-lg font-semibold text-cyan-400">Sales Intelligence</h3>
              
              {/* Summary */}
              {summary && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Summary</h4>
                  <p className="text-gray-300">{summary}</p>
                </div>
              )}

              {/* Talking Points */}
              {talkingPoints.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Talking Points</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {talkingPoints.map((point: string, idx: number) => (
                      <li key={idx} className="text-gray-300">{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Approach */}
              {recommendedApproach && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Recommended Approach</h4>
                  <p className="text-gray-300">{recommendedApproach}</p>
                </div>
              )}

              {/* Recent News */}
              {recentNews && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Recent News</h4>
                  <p className="text-gray-300">{recentNews}</p>
                </div>
              )}

              {/* Tags Grid */}
              <div className="flex flex-wrap gap-2">
                {personaType && (
                  <span className="px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs">
                    {personaType}
                  </span>
                )}
                {vertical && (
                  <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs">
                    {vertical}
                  </span>
                )}
                {companySize && (
                  <span className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">
                    {companySize}
                  </span>
                )}
                {inferredSeniority && (
                  <span className="px-2 py-1 bg-orange-900 text-orange-300 rounded text-xs">
                    {inferredSeniority}
                  </span>
                )}
              </div>
            </div>
          ) : contact.enrichment_status === 'pending' ? (
            <p className="text-gray-500 italic">Contact has not been enriched yet. Click "Enrich Contact" to get sales intelligence.</p>
          ) : contact.enrichment_status === 'processing' ? (
            <p className="text-blue-400 italic">Enrichment in progress...</p>
          ) : contact.enrichment_status === 'failed' ? (
            <p className="text-red-400 italic">Enrichment failed. Try again.</p>
          ) : (
            <p className="text-gray-500 italic">No enrichment data available</p>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 px-6 py-4 flex justify-end gap-3 border-t border-gray-700">
          <button
            onClick={handleEnrich}
            disabled={enriching || contact.enrichment_status === 'processing'}
            className={`px-4 py-2 rounded-md font-medium transition ${
              enriching || contact.enrichment_status === 'processing'
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-cyan-600 text-white hover:bg-cyan-500'
            }`}
          >
            {enriching ? 'Enriching...' : contact.enrichment_status === 'completed' ? 'Re-Enrich' : 'Enrich Contact'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  isLink = false,
}: {
  label: string;
  value?: string | null;
  isLink?: boolean;
}) {
  if (!value) return null;

  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-white">
        {isLink ? (
          <a
            href={value.startsWith('http') ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
