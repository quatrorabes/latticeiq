import { useState } from 'react';
import { createPortal } from 'react-dom';
import supabase from '../lib/supabaseClient';
import type { Contact } from '../types/contact';

interface ContactDetailModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdate: (contact: Contact) => void;
}

export default function ContactDetailModal({
  contact,
  isOpen,
  onClose,
  onContactUpdate,
}: ContactDetailModalProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !contact) return null;

  async function handleEnrich() {
    setIsEnriching(true);
    setError(null);

    try {
      const result = await supabase.auth.getSession();
      const session = result.data.session;

      if (!session) {
        setError('Not authenticated');
        setIsEnriching(false);
        return;
      }

      console.log(`Calling: POST ${import.meta.env.VITE_API_URL}/api/v3/enrich/${contact.id}`);

      // CORRECT ENDPOINT: POST to /api/v3/enrich/{contact_id}
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/enrich/${contact.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`Response status: ${res.status}`);

      if (!res.ok) {
        let errorMsg = `Enrichment failed: ${res.status}`;
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || errorMsg;
        } catch (e) {
          // response not json
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      console.log('Enrichment response:', data);
      
      const updatedContact: Contact = {
        ...contact,
        enrichment_status: data.status,
        enrichment_data: data.enrichment_data,
        enriched_at: new Date().toISOString(),
      };

      onContactUpdate(updatedContact);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Enrichment failed';
      console.error('Enrich error:', msg);
      setError(msg);
    } finally {
      setIsEnriching(false);
    }
  }

  const enrichmentData = contact.enrichment_data as Record<string, any> || {};

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 p-6 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">
              {contact.first_name} {contact.last_name}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 text-sm">Email</p>
                <p className="text-white font-medium">{contact.email}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Company</p>
                <p className="text-white font-medium">{contact.company || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Job Title</p>
                <p className="text-white font-medium">{contact.job_title || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Status</p>
                <p className="text-white font-medium capitalize">
                  {contact.enrichment_status || 'pending'}
                </p>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-700 p-4 rounded">
                <p className="text-slate-400 text-sm">MDCP Score</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {contact.mdcp_score?.toFixed(0) || '-'}
                </p>
              </div>
              <div className="bg-slate-700 p-4 rounded">
                <p className="text-slate-400 text-sm">BANT Score</p>
                <p className="text-2xl font-bold text-green-400">
                  {contact.bant_score?.toFixed(0) || '-'}
                </p>
              </div>
              <div className="bg-slate-700 p-4 rounded">
                <p className="text-slate-400 text-sm">SPICE Score</p>
                <p className="text-2xl font-bold text-purple-400">
                  {contact.spice_score?.toFixed(0) || '-'}
                </p>
              </div>
            </div>

            {/* Enrichment Data */}
            {contact.enrichment_status === 'completed' && enrichmentData && Object.keys(enrichmentData).length > 0 && (
              <>
                {enrichmentData.summary && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Summary</h3>
                    <p className="text-slate-300">{enrichmentData.summary}</p>
                  </div>
                )}

                {enrichmentData.company_overview && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Company Overview</h3>
                    <p className="text-slate-300">{enrichmentData.company_overview}</p>
                  </div>
                )}

                {enrichmentData.talking_points && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Talking Points</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {Array.isArray(enrichmentData.talking_points) ? (
                        enrichmentData.talking_points.map((point: string, idx: number) => (
                          <li key={idx} className="text-slate-300">
                            {point}
                          </li>
                        ))
                      ) : (
                        <li className="text-slate-300">
                          {String(enrichmentData.talking_points)}
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {enrichmentData.recommended_approach && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Recommended Approach</h3>
                    <p className="text-slate-300">{enrichmentData.recommended_approach}</p>
                  </div>
                )}

                {enrichmentData.persona_type && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Persona Type</h3>
                    <p className="text-slate-300">{enrichmentData.persona_type}</p>
                  </div>
                )}

                {enrichmentData.vertical && (
                  <div>
                    <h3 className="text-white font-semibold mb-2">Vertical</h3>
                    <p className="text-slate-300">{enrichmentData.vertical}</p>
                  </div>
                )}
              </>
            )}

            {contact.enrichment_status === 'processing' && (
              <div className="bg-blue-900 bg-opacity-30 border border-blue-500 rounded p-4">
                <p className="text-blue-300">⏳ Enrichment in progress... (this may take 15-30 seconds)</p>
              </div>
            )}

            {contact.enrichment_status === 'pending' && (
              <div className="bg-slate-700 bg-opacity-50 border border-slate-500 rounded p-4">
                <p className="text-slate-300">No enrichment data yet. Click the "Re-Enrich" button below to start enriching this contact with AI-powered sales intelligence.</p>
              </div>
            )}

            {contact.enrichment_status === 'failed' && (
              <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded p-4">
                <p className="text-red-300">❌ Enrichment failed. Please try again.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded p-4">
                <p className="text-red-300">Error: {error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-900 p-6 border-t border-slate-700 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition"
            >
              Close
            </button>
            <button
              onClick={handleEnrich}
              disabled={isEnriching}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition"
            >
              {isEnriching ? '⏳ Enriching...' : 'Re-Enrich'}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}