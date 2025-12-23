// frontend/src/components/ContactDetailModal.tsx
import { useState } from 'react';
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
  title?: string;
  linkedin_url?: string;
  enrichment_status: string;
  enrichment_data?: Record<string, unknown>;
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
  apex_score?: number;
  created_at: string;
  updated_at: string;
}

interface ContactDetailModalProps {
  contact: Contact;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ContactDetailModal({ contact, onClose, onUpdate }: ContactDetailModalProps) {
  const [enriching, setEnriching] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'enrichment' | 'scores'>('details');

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
      onUpdate();
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
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {contact.first_name} {contact.last_name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(['details', 'enrichment', 'scores'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
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
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <DetailRow label="Email" value={contact.email} />
              <DetailRow label="Phone" value={contact.phone} />
              <DetailRow label="Company" value={contact.company} />
              <DetailRow label="Title" value={contact.title} />
              <DetailRow label="LinkedIn" value={contact.linkedin_url} isLink />
              <DetailRow label="Status" value={contact.enrichment_status} />
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="space-y-4">
              {contact.enrichment_data ? (
                <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(contact.enrichment_data, null, 2)}
                </pre>
              ) : (
                <p className="text-gray-400">No enrichment data yet. Click "Enrich" to get started.</p>
              )}
            </div>
          )}

          {activeTab === 'scores' && (
            <div className="grid grid-cols-2 gap-4">
              <ScoreCard label="MDCP Score" score={contact.mdcp_score} color={getScoreColor(contact.mdcp_score)} />
              <ScoreCard label="BANT Score" score={contact.bant_score} color={getScoreColor(contact.bant_score)} />
              <ScoreCard label="SPICE Score" score={contact.spice_score} color={getScoreColor(contact.spice_score)} />
              <ScoreCard label="APEX Score" score={contact.apex_score} color={getScoreColor(contact.apex_score)} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4 p-4 border-t border-gray-700">
          <button
            onClick={enrichContact}
            disabled={enriching}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {enriching ? 'Enriching...' : 'Enrich'}
          </button>
          <button
            onClick={scoreContact}
            disabled={scoring || contact.enrichment_status !== 'enriched'}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {scoring ? 'Scoring...' : 'Score'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, isLink }: { label: string; value?: string; isLink?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      {isLink && value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
          {value}
        </a>
      ) : (
        <span className="text-white">{value || '-'}</span>
      )}
    </div>
  );
}

function ScoreCard({ label, score, color }: { label: string; score?: number; color: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{score ?? '-'}</p>
    </div>
  );
}
