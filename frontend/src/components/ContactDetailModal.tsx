import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { EnrichedContact } from '../types/contact';

interface ContactDetailModalProps {
  contact: EnrichedContact | null;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdate?: (updated: EnrichedContact) => void;
  session?: any;
}

export default function ContactDetailModal({
  contact,
  isOpen,
  onClose,
  onContactUpdate,
  session,
}: ContactDetailModalProps) {
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichData, setEnrichData] = useState<any>(contact?.enrichment_data);

  if (!isOpen || !contact) return null;

  const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

  const handleEnrich = async () => {
    if (!session?.access_token || !contact?.id) {
      setError('Not authenticated or missing contact ID');
      return;
    }

    setEnriching(true);
    setError(null);

    try {
      const token = session.access_token;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Origin': window.location.origin,
      };

      // CRITICAL: Backend endpoint is POST /api/v3/enrich/{id}
      const response = await fetch(`${API_BASE}/api/v3/enrich/${contact.id}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Enrichment response:', data);

      // Update local state with new enrichment data
      if (data.enrichment_data) {
        setEnrichData(data.enrichment_data);
      }

      // Update parent contacts list if callback provided
      if (onContactUpdate && data) {
        onContactUpdate({
          ...contact,
          enrichment_data: data.enrichment_data,
          enrichment_status: data.enrichment_status || 'completed',
          mdcp_score: data.mdcp_score,
          bant_score: data.bant_score,
          spice_score: data.spice_score,
        });
      }
    } catch (err: any) {
      console.error('❌ Enrichment error:', err);
      setError(err.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const enrichData_ = enrichData || contact?.enrichment_data;

  const modalContent = (
    <div className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 z-50">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 p-6 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {contact.first_name} {contact.last_name}
              </h2>
              <p className="text-sm text-gray-400 mt-1">ID: {contact.id}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-blue-400 mb-4">📋 Contact Information</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400">EMAIL</label>
                <p className="text-white font-mono">{contact.email || '(empty)'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">COMPANY</label>
                <p className="text-white">{contact.company || '(empty)'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">JOB TITLE</label>
                <p className="text-white">{contact.title || contact.job_title || '(empty)'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">PHONE</label>
                <p className="text-white">{contact.phone || '(empty)'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">LINKEDIN URL</label>
                <p className="text-white break-all">{contact.linkedin_url || '(empty)'}</p>
              </div>
            </div>
          </div>

          {/* Scores */}
          <div>
            <h3 className="text-lg font-semibold text-blue-400 mb-4">📊 Scores</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <p className="text-gray-400 text-sm">MDCP</p>
                <p className="text-2xl font-bold text-teal-400">{contact.mdcp_score ?? '-'}</p>
                {contact.mdcp_tier && (
                  <p className="text-xs text-gray-500 mt-1">{contact.mdcp_tier}</p>
                )}
              </div>
              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <p className="text-gray-400 text-sm">BANT</p>
                <p className="text-2xl font-bold text-green-400">{contact.bant_score ?? '-'}</p>
                {contact.bant_tier && (
                  <p className="text-xs text-gray-500 mt-1">{contact.bant_tier}</p>
                )}
              </div>
              <div className="bg-gray-800 p-4 rounded border border-gray-700">
                <p className="text-gray-400 text-sm">SPICE</p>
                <p className="text-2xl font-bold text-purple-400">{contact.spice_score ?? '-'}</p>
                {contact.spice_tier && (
                  <p className="text-xs text-gray-500 mt-1">{contact.spice_tier}</p>
                )}
              </div>
            </div>
          </div>

          {/* Enrichment Status */}
          <div>
            <h3 className="text-lg font-semibold text-blue-400 mb-4">
              🔄 Enrichment Status
            </h3>
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <p className="text-gray-400 text-sm">STATUS</p>
              <p className="text-lg font-mono text-white mt-1">
                {contact.enrichment_status || 'pending'}
              </p>
            </div>
          </div>

          {/* Enrichment Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded p-4">
              <p className="text-red-300 text-sm">
                <strong>❌ Enrichment Error:</strong> {error}
              </p>
            </div>
          )}

          {/* Enrichment Data */}
          {enrichData_ && (
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-4">
                ✨ Sales Intelligence
              </h3>
              <div className="space-y-4">
                {enrichData_.summary && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Summary</h4>
                    <p className="text-gray-300 text-sm">{enrichData_.summary}</p>
                  </div>
                )}

                {enrichData_.company_overview && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Company Overview</h4>
                    <p className="text-gray-300 text-sm">{enrichData_.company_overview}</p>
                  </div>
                )}

                {enrichData_.talking_points && Array.isArray(enrichData_.talking_points) && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Talking Points</h4>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                      {enrichData_.talking_points.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {enrichData_.hook && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Hook</h4>
                    <p className="text-gray-300 text-sm">{enrichData_.hook}</p>
                  </div>
                )}

                {enrichData_.recommended_approach && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Recommended Approach</h4>
                    <p className="text-gray-300 text-sm">{enrichData_.recommended_approach}</p>
                  </div>
                )}

                {enrichData_.persona_type && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Persona Type</h4>
                    <p className="text-gray-300 text-sm font-mono">{enrichData_.persona_type}</p>
                  </div>
                )}

                {enrichData_.vertical && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Vertical</h4>
                    <p className="text-gray-300 text-sm font-mono">{enrichData_.vertical}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!enrichData_ && contact.enrichment_status !== 'failed' && (
            <div className="bg-gray-800 p-4 rounded border border-gray-700 text-center">
              <p className="text-gray-400 text-sm">
                📭 No enrichment data yet. Click "Re-Enrich" below to start.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 p-6 border-t border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition"
          >
            Close
          </button>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className={`px-4 py-2 rounded font-semibold transition ${
              enriching
                ? 'bg-yellow-600 text-yellow-100 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {enriching ? '🔄 Re-Enriching...' : '⚡ Re-Enrich'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
