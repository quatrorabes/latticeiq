// frontend/src/components/ContactDetailModal.tsx
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  job_title?: string;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  vertical?: string;
  persona_type?: string;
  enrichment_status?: string;
  enrichment_data?: any;
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
  mdcp_tier?: string;
  bant_tier?: string;
  spice_tier?: string;
}

interface ContactDetailModalProps {
  contact: Contact | null;
  onClose: () => void;
  onUpdate: (contact: Contact) => void;
}

export default function ContactDetailModal({
  contact,
  onClose,
  onUpdate,
}: ContactDetailModalProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!contact) return null;

  const handleEnrich = async () => {
    setIsEnriching(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}/api/v3/enrich/${contact.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Enrichment failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Enrichment complete:', result);

      // Update contact with enrichment data
      const updatedContact: Contact = {
        ...contact,
        enrichment_status: 'completed',
        enrichment_data: result.enrichment_data,
      };

      onUpdate(updatedContact);
    } catch (err: any) {
      console.error('❌ Enrichment error:', err);
      setError(err.message || 'Enrichment failed');
    } finally {
      setIsEnriching(false);
    }
  };

  const enrichData = contact.enrichment_data || {};

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-50 w-full max-w-2xl mx-4 bg-gray-900 rounded-xl border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-gray-700 bg-gray-900">
          <h2 className="text-xl font-bold text-white">
            {contact.first_name} {contact.last_name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Email</div>
                <div className="text-white">{contact.email || '(empty)'}</div>
              </div>
              <div>
                <div className="text-gray-400">Company</div>
                <div className="text-white">{contact.company || '(empty)'}</div>
              </div>
              <div>
                <div className="text-gray-400">Title</div>
                <div className="text-white">
                  {contact.title || contact.job_title || '(empty)'}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Phone</div>
                <div className="text-white">{contact.phone || '(empty)'}</div>
              </div>
              {contact.linkedin_url && (
                <div className="col-span-2">
                  <div className="text-gray-400">LinkedIn</div>
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 truncate"
                  >
                    {contact.linkedin_url}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Scores */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
              Qualification Scores
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                <div className="text-gray-400">MDCP</div>
                <div className="text-xl font-bold text-cyan-400">
                  {contact.mdcp_score ?? '-'}
                </div>
                {contact.mdcp_tier && (
                  <div className="text-xs text-gray-400 mt-1">{contact.mdcp_tier}</div>
                )}
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                <div className="text-gray-400">BANT</div>
                <div className="text-xl font-bold text-cyan-400">
                  {contact.bant_score ?? '-'}
                </div>
                {contact.bant_tier && (
                  <div className="text-xs text-gray-400 mt-1">{contact.bant_tier}</div>
                )}
              </div>
              <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                <div className="text-gray-400">SPICE</div>
                <div className="text-xl font-bold text-cyan-400">
                  {contact.spice_score ?? '-'}
                </div>
                {contact.spice_tier && (
                  <div className="text-xs text-gray-400 mt-1">{contact.spice_tier}</div>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
              Status
            </h3>
            <div className="px-3 py-2 bg-gray-800/50 rounded border border-gray-700 text-sm">
              <span className="text-gray-400">Enrichment Status:</span>
              <span className="ml-2 font-medium text-white capitalize">
                {contact.enrichment_status || 'pending'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              ❌ Enrichment Error: {error}
            </div>
          )}

          {/* Enrichment Data */}
          {contact.enrichment_status === 'completed' && enrichData.summary && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Summary</h4>
                <p className="text-sm text-gray-300">{enrichData.summary}</p>
              </div>

              {enrichData.company_overview && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    Company Overview
                  </h4>
                  <p className="text-sm text-gray-300">{enrichData.company_overview}</p>
                </div>
              )}

              {enrichData.recommended_approach && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    Recommended Approach
                  </h4>
                  <p className="text-sm text-gray-300">{enrichData.recommended_approach}</p>
                </div>
              )}

              {enrichData.persona_type && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Persona</h4>
                  <p className="text-sm text-gray-300">{enrichData.persona_type}</p>
                </div>
              )}

              {enrichData.vertical && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Vertical</h4>
                  <p className="text-sm text-gray-300">{enrichData.vertical}</p>
                </div>
              )}

              {enrichData.talking_points && Array.isArray(enrichData.talking_points) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">
                    Talking Points
                  </h4>
                  <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                    {enrichData.talking_points.map((point: string, idx: number) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {contact.enrichment_status === 'processing' && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Enrichment in progress...
            </div>
          )}

          {contact.enrichment_status !== 'completed' && contact.enrichment_status !== 'processing' && (
            <div className="p-3 bg-gray-800/50 rounded border border-gray-700 text-gray-400 text-sm">
              📭 No enrichment data yet. Click "Re-Enrich" below to start.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex gap-3 p-6 border-t border-gray-700 bg-gray-900">
          <button
            onClick={handleEnrich}
            disabled={isEnriching}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isEnriching
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
            }`}
          >
            {isEnriching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Re-Enrich
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}