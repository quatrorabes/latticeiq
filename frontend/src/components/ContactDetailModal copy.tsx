// frontend/src/components/ContactDetailModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  job_title?: string;
  linkedin_url?: string;
  website?: string;
  enrichment_status: string;
  enrichment_data?: {
    company_overview?: string;
    summary?: string;
    talking_points?: string[];
    persona?: string;
    seniority?: string;
    industry?: string;
    keywords?: string[];
  };
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
  apex_score?: number;
  created_at: string;
  updated_at: string;
}

interface ContactDetailModalProps {
  contact: Contact | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ContactDetailModal({
  contact,
  onClose,
  onUpdate,
}: ContactDetailModalProps) {
  const [enriching, setEnriching] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'enrichment' | 'scores'>('details');

  if (!contact) return null;

  const enrichContact = async () => {
    try {
      setEnriching(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/v3/enrich/${contact.id}`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Enrichment failed');
      
      // Refresh data after enrichment
      setTimeout(() => {
        onUpdate();
      }, 2000);
    } catch (err) {
      console.error('Enrichment error:', err);
    } finally {
      setEnriching(false);
    }
  };

  const scoreContact = async () => {
    try {
      setScoring(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/v3/score/${contact.id}`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Scoring failed');
      onUpdate();
    } catch (err) {
      console.error('Scoring error:', err);
    } finally {
      setScoring(false);
    }
  };

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getEnrichmentStatus = () => {
    if (contact.enrichment_status === 'enriched') {
      return <span className="text-xs px-2 py-1 bg-green-900 text-green-300 rounded">Enriched</span>;
    }
    if (contact.enrichment_status === 'pending') {
      return <span className="text-xs px-2 py-1 bg-yellow-900 text-yellow-300 rounded">Pending</span>;
    }
    return <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">Not Enriched</span>;
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
              {contact.first_name} {contact.last_name}
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
          {(['details', 'enrichment', 'scores'] as const).map((tab) => (
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
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <DetailRow label="Email" value={contact.email} isLink />
              <DetailRow label="Phone" value={contact.phone} />
              <DetailRow label="Company" value={contact.company} />
              <DetailRow label="Job Title" value={contact.job_title} />
              <DetailRow label="LinkedIn" value={contact.linkedin_url} isLink />
              <DetailRow label="Website" value={contact.website} isLink />
              <DetailRow
                label="Created"
                value={new Date(contact.created_at).toLocaleDateString()}
              />
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="space-y-6">
              {contact.enrichment_data ? (
                <>
                  {contact.enrichment_data.summary && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-2">Summary</h3>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {contact.enrichment_data.summary}
                      </p>
                    </div>
                  )}

                  {contact.enrichment_data.company_overview && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-2">Company Overview</h3>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {contact.enrichment_data.company_overview}
                      </p>
                    </div>
                  )}

                  {contact.enrichment_data.talking_points && contact.enrichment_data.talking_points.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-2">Talking Points</h3>
                      <ul className="space-y-2">
                        {contact.enrichment_data.talking_points.map((point, idx) => (
                          <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-cyan-400 mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    {contact.enrichment_data.persona && (
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">Persona</p>
                        <p className="text-sm text-cyan-400 font-medium">
                          {contact.enrichment_data.persona}
                        </p>
                      </div>
                    )}
                    {contact.enrichment_data.seniority && (
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">Seniority</p>
                        <p className="text-sm text-cyan-400 font-medium">
                          {contact.enrichment_data.seniority}
                        </p>
                      </div>
                    )}
                    {contact.enrichment_data.industry && (
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">Industry</p>
                        <p className="text-sm text-cyan-400 font-medium">
                          {contact.enrichment_data.industry}
                        </p>
                      </div>
                    )}
                  </div>

                  {contact.enrichment_data.keywords && contact.enrichment_data.keywords.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-400 mb-2">Keywords</h3>
                      <div className="flex flex-wrap gap-2">
                        {contact.enrichment_data.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">No enrichment data yet.</p>
                  <button
                    onClick={enrichContact}
                    disabled={enriching}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white rounded font-medium transition"
                  >
                    {enriching ? 'Enriching...' : 'Start Enrichment'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'scores' && (
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard
                label="MDCP Score"
                score={contact.mdcp_score}
                color={getScoreColor(contact.mdcp_score)}
              />
              <ScoreCard
                label="BANT Score"
                score={contact.bant_score}
                color={getScoreColor(contact.bant_score)}
              />
              <ScoreCard
                label="SPICE Score"
                score={contact.spice_score}
                color={getScoreColor(contact.spice_score)}
              />
              {contact.apex_score && (
                <ScoreCard
                  label="APEX Score"
                  score={contact.apex_score}
                  color={getScoreColor(contact.apex_score)}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button
            onClick={enrichContact}
            disabled={enriching || contact.enrichment_status === 'enriched'}
            className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-medium transition"
          >
            {enriching ? 'Enriching...' : 'Enrich Now'}
          </button>
          <button
            onClick={scoreContact}
            disabled={scoring}
            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-medium transition"
          >
            {scoring ? 'Scoring...' : 'Score Contact'}
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

// Helper Components
function DetailRow({ label, value, isLink }: { label: string; value?: string; isLink?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-800">
      <span className="text-sm text-gray-400">{label}</span>
      {isLink && value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-cyan-400 hover:text-cyan-300 truncate"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-300">{value || '-'}</span>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  color,
}: {
  label: string;
  score?: number;
  color: string;
}) {
  return (
    <div className="bg-gray-800 p-4 rounded border border-gray-700">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>
        {score ?? '-'}
      </p>
    </div>
  );
}
