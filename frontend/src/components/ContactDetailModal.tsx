import { useState } from 'react';
import type { Contact } from '../types/contact';

interface ContactDetailModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrichComplete: () => void;
}

export default function ContactDetailModal({ contact, isOpen, onClose, onEnrichComplete }: ContactDetailModalProps) {
  const [isEnriching, setIsEnriching] = useState(false);

  if (!isOpen || !contact) return null;

  const handleEnrich = async () => {
    if (!contact?.id) return;
    setIsEnriching(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'}/api/v3/enrich/${contact.id}`,
        { method: 'POST' }
      );
      if (response.ok) {
        onEnrichComplete();
      }
    } catch (error) {
      console.error('Enrichment failed:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
    <div className="flex justify-between py-2 border-b border-gray-700">
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{value || '-'}</span>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-start p-6 border-b border-gray-700 sticky top-0 bg-gray-900">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {contact.first_name} {contact.last_name}
              </h2>
              <p className="text-gray-400">{contact.email}</p>
              {contact.enrichment_status === 'completed' && contact.enriched_at && (
                <p className="text-xs text-green-400 mt-1">
                  Enriched: {new Date(contact.enriched_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Basic Info Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">Contact Info</h3>
                <InfoRow label="Title" value={contact.job_title} />
                <InfoRow label="Company" value={contact.company} />
                <InfoRow label="Phone" value={contact.phone} />
                <InfoRow label="Website" value={contact.website} />
                <InfoRow label="LinkedIn" value={contact.linkedin_url ? '✓ Profile' : '-'} />
              </div>

              {/* Right Column - Scoring */}
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">Lead Scores</h3>
                <InfoRow label="MDCP" value={contact.mdcp_score} />
                <InfoRow label="BANT" value={contact.bant_score} />
                <InfoRow label="SPICE" value={contact.spice_score} />
                <InfoRow label="Apex" value={contact.apex_score} />
                <InfoRow label="Status" value={contact.enrichment_status} />
              </div>
            </div>

            {/* Sales Intelligence Section */}
            {contact.enrichment_status === 'completed' && contact.enrichment_data && (
              <div className="space-y-4 border-t border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-cyan-400">Sales Intelligence</h3>

                {/* Summary */}
                {contact.enrichment_data.summary && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Summary</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{contact.enrichment_data.summary}</p>
                  </div>
                )}

                {/* Company Overview */}
                {contact.enrichment_data.company_overview && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Company Overview</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{contact.enrichment_data.company_overview}</p>
                  </div>
                )}

                {/* Talking Points */}
                {contact.enrichment_data.talking_points && contact.enrichment_data.talking_points.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Talking Points</h4>
                    <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                      {contact.enrichment_data.talking_points.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Approach */}
                {contact.enrichment_data.recommended_approach && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Recommended Approach</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{contact.enrichment_data.recommended_approach}</p>
                  </div>
                )}

                {/* Recent News */}
                {contact.enrichment_data.recent_news && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Recent News</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{contact.enrichment_data.recent_news}</p>
                  </div>
                )}

                {/* Tags */}
                {contact.enrichment_data.tags && contact.enrichment_data.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {contact.enrichment_data.tags.map((tag: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-gray-800 text-cyan-400 text-xs rounded-full border border-gray-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Additional Fields */}
                {contact.enrichment_data.persona_type && (
                  <InfoRow label="Persona Type" value={contact.enrichment_data.persona_type} />
                )}
                {contact.enrichment_data.vertical && (
                  <InfoRow label="Vertical" value={contact.enrichment_data.vertical} />
                )}
                {contact.enrichment_data.company_size && (
                  <InfoRow label="Company Size" value={contact.enrichment_data.company_size} />
                )}
              </div>
            )}

            {/* No Enrichment State */}
            {contact.enrichment_status !== 'completed' && (
              <div className="border-t border-gray-700 pt-6 text-center">
                <p className="text-gray-400 text-sm">
                  {contact.enrichment_status === 'processing' ? 'Enrichment in progress...' : 'Click "Re-Enrich" to generate sales intelligence'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-700 sticky bottom-0 bg-gray-900">
            <button
              onClick={handleEnrich}
              disabled={isEnriching || contact.enrichment_status === 'processing'}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition"
            >
              {isEnriching ? 'Enriching...' : 'Re-Enrich'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
