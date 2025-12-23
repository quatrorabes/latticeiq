import type { Contact } from '../types/contact';
import { X, Mail, Phone, Building, Briefcase } from 'lucide-react';
import EnrichButton from './EnrichButton';
import { EnrichmentProgress } from './EnrichmentProgress';
import { useState, useEffect } from 'react';
import { getEnrichmentStatus } from '../services/enrichmentService';
import type { EnrichmentStatus } from '../services/enrichmentService';

interface ContactDetailModalProps {
  contact: Contact;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment' | 'raw'>('overview');
  const [enrichmentStatus, setEnrichmentStatus] = useState<EnrichmentStatus | null>(null);

  // Poll enrichment status when modal opens
  useEffect(() => {
    if (!isOpen || contact.enrichment_status === 'completed') return;

    const pollStatus = async () => {
      try {
        const status = await getEnrichmentStatus(Number(contact.id));
        setEnrichmentStatus(status);

        // Keep polling if still processing
        if (status.status === 'processing' || status.status === 'pending') {
          setTimeout(pollStatus, 2000);
        }
      } catch (err) {
        console.error('Error polling enrichment status:', err);
      }
    };

    // Initial poll
    pollStatus();
  }, [isOpen, contact.id, contact.enrichment_status]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {contact.first_name} {contact.last_name}
            </h2>
            <p className="text-gray-400 text-sm mt-1">{contact.title} at {contact.company}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 bg-gray-800 px-6 flex gap-4 sticky top-[72px]">
          {(['overview', 'enrichment', 'raw'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-2 border-b-2 transition font-medium text-sm ${
                activeTab === tab
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'enrichment' && 'Enrichment'}
              {tab === 'raw' && 'Raw Data'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <Mail size={16} />
                    <span>Email</span>
                  </div>
                  <p className="text-white font-medium break-all">{contact.email}</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <Phone size={16} />
                    <span>Phone</span>
                  </div>
                  <p className="text-white font-medium">{contact.phone || '—'}</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <Building size={16} />
                    <span>Company</span>
                  </div>
                  <p className="text-white font-medium">{contact.company}</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                    <Briefcase size={16} />
                    <span>Title</span>
                  </div>
                  <p className="text-white font-medium">{contact.title}</p>
                </div>
              </div>

              {/* Scores (if enriched) */}
              {contact.enrichment_data?.scores && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-white font-bold mb-4">Qualification Scores</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'APEX', value: contact.enrichment_data.scores.apex_score },
                      { label: 'MDCP', value: contact.enrichment_data.scores.mdcp_score },
                      { label: 'BANT', value: contact.enrichment_data.scores.bant_score },
                      { label: 'SPICE', value: contact.enrichment_data.scores.spice_score },
                    ].map(score => (
                      <div key={score.label} className="flex justify-between items-center">
                        <span className="text-gray-400">{score.label}:</span>
                        <span className="text-cyan-400 font-bold">{score.value}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Enrich Button */}
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-white font-bold mb-3">Enrichment</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm">
                      Status: <span className="font-bold text-cyan-400">{contact.enrichment_status || 'pending'}</span>
                    </p>
                    {contact.enriched_at && (
                      <p className="text-gray-400 text-xs mt-1">
                        Last enriched: {new Date(contact.enriched_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <EnrichButton
                    contactId={contact.id}
                    variant="modal"
                    onComplete={onEnrichComplete}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <div className="space-y-6">
              <EnrichmentProgress status={enrichmentStatus} />

              {contact.enrichment_data?.profile && (
                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-white font-bold mb-2">Executive Summary</h4>
                    <p className="text-gray-300 text-sm">
                      {contact.enrichment_data.profile.executive_summary}
                    </p>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h4 className="text-white font-bold mb-2">Role & Responsibilities</h4>
                    <p className="text-gray-300 text-sm">
                      {contact.enrichment_data.profile.role_responsibilities}
                    </p>
                  </div>

                  {contact.enrichment_data.profile.deal_triggers && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-white font-bold mb-3">Deal Triggers</h4>
                      <ul className="space-y-2">
                        {contact.enrichment_data.profile.deal_triggers.map((trigger, i) => (
                          <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="text-cyan-400 mt-1">•</span>
                            <span>{trigger}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {contact.enrichment_data.profile.objection_handlers && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h4 className="text-white font-bold mb-3">Common Objections & Handlers</h4>
                      <ul className="space-y-2">
                        {contact.enrichment_data.profile.objection_handlers.map((handler, i) => (
                          <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="text-orange-400 mt-1">•</span>
                            <span>{handler}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!contact.enrichment_data && (
                <div className="bg-gray-800 rounded-lg p-6 text-center">
                  <p className="text-gray-400">No enrichment data yet. Click the Enrich button above to get started.</p>
                </div>
              )}
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === 'raw' && (
            <div className="bg-gray-800 rounded-lg p-4">
              <pre className="text-gray-300 text-xs overflow-x-auto">
                {JSON.stringify(contact.enrichment_data || {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
