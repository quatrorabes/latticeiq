import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const APIURL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  userid: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  linkedinurl?: string | null;
  website?: string | null;
  vertical?: string | null;
  personatype?: string | null;
  enrichmentstatus: 'pending' | 'processing' | 'completed' | 'failed';
  enrichmentdata?: {
    summary?: string;
    openingline?: string;
    talkingpoints?: string[];
    personatype?: string;
    vertical?: string;
    inferredtitle?: string;
    inferredcompanywebsite?: string;
    inferredlocation?: string;
    rawtext?: string;
  } | null;
  apexscore?: number | null;
  mdcscore?: number | null;
  rssscore?: number | null;
  createdat?: string;
  updatedat?: string;
}

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
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment'>('overview');

  if (!contact || !isOpen) return null;

  const enrichContact = async () => {
    try {
      setEnriching(true);
      
      // Get Supabase session for JWT token
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        alert('Authentication required. Please log in.');
        return;
      }

      // Call the correct endpoint: /api/v3/enrichment/quick-enrich/{contact_id}
      const response = await fetch(
        `${APIURL}/api/v3/enrichment/quick-enrich/${contact.id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Enrichment failed');
      }

      // Success - refresh after a moment to allow backend processing
      setTimeout(() => {
        onEnrichComplete?.();
        alert('Enrichment triggered! Data will appear in a few seconds.');
      }, 500);
    } catch (err) {
      console.error('Enrichment error:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setEnriching(false);
    }
  };

  const getEnrichmentStatus = () => {
    switch (contact.enrichmentstatus) {
      case 'completed':
        return <span className="text-xs px-2 py-1 bg-green-900 text-green-300 rounded">✓ Enriched</span>;
      case 'processing':
        return <span className="text-xs px-2 py-1 bg-blue-900 text-blue-300 rounded">◐ Processing...</span>;
      case 'pending':
        return <span className="text-xs px-2 py-1 bg-yellow-900 text-yellow-300 rounded">○ Pending</span>;
      case 'failed':
        return <span className="text-xs px-2 py-1 bg-red-900 text-red-300 rounded">✗ Failed</span>;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] bg-gray-900 border border-gray-800 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {contact.firstname} {contact.lastname}
            </h2>
            <p className="text-sm text-gray-400">{contact.email}</p>
          </div>
          <div className="flex items-center gap-3">
            {getEnrichmentStatus()}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded transition"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gray-800">
          {(['overview', 'enrichment'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <DetailRow label="Email" value={contact.email} isLink />
              <DetailRow label="Phone" value={contact.phone} />
              <DetailRow label="Company" value={contact.company} />
              <DetailRow label="Title" value={contact.title} />
              <DetailRow label="LinkedIn" value={contact.linkedinurl} isLink />
              <DetailRow label="Website" value={contact.website} isLink />
              {contact.apexscore !== null && (
                <DetailRow
                  label="APEX Score"
                  value={contact.apexscore?.toString()}
                />
              )}
              {contact.vertical && (
                <DetailRow label="Vertical" value={contact.vertical} />
              )}
              {contact.personatype && (
                <DetailRow label="Persona" value={contact.personatype} />
              )}
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="space-y-6">
              {contact.enrichmentdata ? (
                <>
                  {contact.enrichmentdata.summary && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-2">
                        Summary
                      </h3>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {contact.enrichmentdata.summary}
                      </p>
                    </div>
                  )}

                  {contact.enrichmentdata.openingline && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-2">
                        Opening Line
                      </h3>
                      <p className="text-sm text-gray-300 italic">
                        "{contact.enrichmentdata.openingline}"
                      </p>
                    </div>
                  )}

                  {contact.enrichmentdata.talkingpoints &&
                    contact.enrichmentdata.talkingpoints.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-cyan-400 mb-2">
                          Talking Points
                        </h3>
                        <ul className="space-y-2">
                          {contact.enrichmentdata.talkingpoints.map(
                            (point, idx) => (
                              <li
                                key={idx}
                                className="text-sm text-gray-300 flex items-start gap-2"
                              >
                                <span className="text-cyan-400 mt-1">•</span>
                                <span>{point}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {contact.enrichmentdata.inferredcompanywebsite && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-2">
                        Company Website
                      </h3>
                      <a
                        href={contact.enrichmentdata.inferredcompanywebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cyan-400 hover:text-cyan-300 truncate"
                      >
                        {contact.enrichmentdata.inferredcompanywebsite}
                      </a>
                    </div>
                  )}

                  {(contact.enrichmentdata.personatype ||
                    contact.enrichmentdata.vertical ||
                    contact.enrichmentdata.inferredtitle ||
                    contact.enrichmentdata.inferredlocation) && (
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      {contact.enrichmentdata.personatype && (
                        <div className="bg-gray-800 p-3 rounded">
                          <p className="text-xs text-gray-400">Persona</p>
                          <p className="text-sm text-cyan-400 font-medium">
                            {contact.enrichmentdata.personatype}
                          </p>
                        </div>
                      )}
                      {contact.enrichmentdata.vertical && (
                        <div className="bg-gray-800 p-3 rounded">
                          <p className="text-xs text-gray-400">Vertical</p>
                          <p className="text-sm text-cyan-400 font-medium">
                            {contact.enrichmentdata.vertical}
                          </p>
                        </div>
                      )}
                      {contact.enrichmentdata.inferredtitle && (
                        <div className="bg-gray-800 p-3 rounded">
                          <p className="text-xs text-gray-400">Inferred Title</p>
                          <p className="text-sm text-cyan-400 font-medium">
                            {contact.enrichmentdata.inferredtitle}
                          </p>
                        </div>
                      )}
                      {contact.enrichmentdata.inferredlocation && (
                        <div className="bg-gray-800 p-3 rounded">
                          <p className="text-xs text-gray-400">Location</p>
                          <p className="text-sm text-cyan-400 font-medium">
                            {contact.enrichmentdata.inferredlocation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">No enrichment data yet.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button
            onClick={enrichContact}
            disabled={enriching || contact.enrichmentstatus === 'processing'}
            className={`flex-1 px-4 py-2 rounded font-medium transition ${
              enriching || contact.enrichmentstatus === 'processing'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-700 text-white'
            }`}
          >
            {enriching ? '⟳ Enriching...' : 'Enrich Now'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Helper Components
 */

function DetailRow({
  label,
  value,
  isLink,
}: {
  label: string;
  value?: string | null;
  isLink?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-800">
      <span className="text-sm text-gray-400">{label}</span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-cyan-400 hover:text-cyan-300 truncate"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-300">{value}</span>
      )}
    </div>
  );
}
