import { useState } from 'react';
import { Contact } from '../types/contact';

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
          <div className="flex justify-between items-start p-6 border-b border-gray-700">
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
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <InfoRow label="Title" value={contact.job_title} />
                <InfoRow label="Company" value={contact.company} />
                <InfoRow label="Phone" value={contact.phone} />
              </div>
              <div>
                <InfoRow label="MDCP" value={contact.mdcp_score} />
                <InfoRow label="BANT" value={contact.bant_score} />
                <InfoRow label="SPICE" value={contact.spice_score} />
              </div>
            </div>

            {/* Sales Intelligence */}
            {contact.enrichment_status === 'completed' && contact.sales_intel && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-cyan-400">Sales Intelligence</h3>
                
                {contact.sales_intel.summary && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Summary</h4>
                    <p className="text-gray-400 text-sm">{contact.sales_intel.summary}</p>
                  </div>
                )}

                {contact.sales_intel.talking_points && contact.sales_intel.talking_points.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Talking Points</h4>
                    <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                      {contact.sales_intel.talking_points.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {contact.sales_intel.recommended_approach && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Recommended Approach</h4>
                    <p className="text-gray-400 text-sm">{contact.sales_intel.recommended_approach}</p>
                  </div>
                )}

                {contact.sales_intel.recent_news && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Recent News</h4>
                    <p className="text-gray-400 text-sm">{contact.sales_intel.recent_news}</p>
                  </div>
                )}

                {contact.sales_intel.tags && contact.sales_intel.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {contact.sales_intel.tags.map((tag: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-gray-800 text-cyan-400 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
            <button
              onClick={handleEnrich}
              disabled={isEnriching}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white rounded transition"
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
