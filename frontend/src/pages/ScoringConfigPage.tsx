// frontend/src/pages/ScoringConfigPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Sliders, Play, RefreshCw, CheckCircle, AlertCircle, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  job_title?: string;
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
  mdcp_tier?: string;
  bant_tier?: string;
  spice_tier?: string;
}

interface ScoreAllResult {
  ok?: boolean;
  framework: string;
  total_contacts?: number;
  total?: number;
  scored?: number;
  updated?: number;
  failed?: { contact_id: string; error: string }[];
  errors?: { contact_id: string; error: string }[];
  message: string;
}

const FRAMEWORKS = [
  {
    id: 'mdcp',
    name: 'MDCP',
    description: 'Money, Decision-maker, Champion, Process',
    detail: 'Best for straightforward enterprise sales with clear budget and decision-makers.',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'bant',
    name: 'BANT',
    description: 'Budget, Authority, Need, Timeline',
    detail: 'Industry standard for enterprise sales qualification with detailed criteria.',
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 'spice',
    name: 'SPICE',
    description: 'Situation, Problem, Implication, Critical Event, Decision',
    detail: 'Best for complex solutions with multiple stakeholders.',
    color: 'from-green-500 to-emerald-500',
  },
];

export default function ScoringConfigPage() {
  const location = useLocation();
  const [selectedFramework, setSelectedFramework] = useState<string>('mdcp');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreAllResult | null>(null);

  // Fetch contacts on mount and when navigating back to this page
  useEffect(() => {
    fetchContacts();
  }, [location.key]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/v3/contacts`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different response shapes
      if (Array.isArray(data)) {
        setContacts(data);
      } else if (data?.contacts && Array.isArray(data.contacts)) {
        setContacts(data.contacts);
      } else if (data?.data && Array.isArray(data.data)) {
        setContacts(data.data);
      } else {
        console.warn('Unexpected contacts response:', data);
        setContacts([]);
      }
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      setError(err.message || 'Failed to fetch contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleScoreAll = async () => {
    setScoring(true);
    setError(null);
    setSuccess(null);
    setScoreResult(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/v3/scoring/score-all?framework=${selectedFramework}`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Scoring failed: ${response.status}`);
      }
      
      const result: ScoreAllResult = await response.json();
      setScoreResult(result);
      setSuccess(result.message);
      
      // Refresh contacts to show updated scores
      await fetchContacts();
    } catch (err: any) {
      console.error('Error scoring contacts:', err);
      setError(err.message || 'Failed to score contacts');
    } finally {
      setScoring(false);
    }
  };

  const getTierBadge = (tier?: string) => {
    if (!tier) return null;
    const colors: Record<string, string> = {
      hot: 'bg-red-500/20 text-red-400 border-red-500/30',
      warm: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      cold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[tier] || 'bg-gray-500/20 text-gray-400'}`}>
        {tier.toUpperCase()}
      </span>
    );
  };

  const getScoreForFramework = (contact: Contact): { score?: number; tier?: string } => {
    switch (selectedFramework) {
      case 'mdcp':
        return { score: contact.mdcp_score, tier: contact.mdcp_tier };
      case 'bant':
        return { score: contact.bant_score, tier: contact.bant_tier };
      case 'spice':
        return { score: contact.spice_score, tier: contact.spice_tier };
      default:
        return {};
    }
  };

  const failedItems = scoreResult?.failed || scoreResult?.errors || [];

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Sliders className="w-8 h-8 text-cyan-400" />
              Scoring Configuration
            </h1>
            <p className="text-gray-400 mt-2">
              Customize how leads are qualified and prioritized. Set weights and thresholds for each framework.
            </p>
          </div>
          <button
            onClick={fetchContacts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Framework Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {FRAMEWORKS.map((fw) => (
            <button
              key={fw.id}
              onClick={() => setSelectedFramework(fw.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                selectedFramework === fw.id
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className={`text-lg font-bold bg-gradient-to-r ${fw.color} bg-clip-text text-transparent`}>
                {fw.name}
              </div>
              <div className="text-sm text-gray-400 mt-1">{fw.description}</div>
              <div className="text-xs text-gray-500 mt-2">{fw.detail}</div>
            </button>
          ))}
        </div>

        {/* Score All Button */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Users className="w-8 h-8 text-cyan-400" />
              <div>
                <h3 className="text-lg font-semibold">Score All Contacts</h3>
                <p className="text-gray-400 text-sm">
                  Apply {selectedFramework.toUpperCase()} scoring to all {contacts.length} contacts
                </p>
              </div>
            </div>
            <button
              onClick={handleScoreAll}
              disabled={scoring || contacts.length === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                scoring || contacts.length === 0
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400'
              }`}
            >
              {scoring ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Scoring...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Score All
                </>
              )}
            </button>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400">{success}</span>
            </div>
          )}

          {failedItems.length > 0 && (
            <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="text-orange-400 font-medium mb-2">
                {failedItems.length} contacts failed to score:
              </div>
              <ul className="text-sm text-gray-400 list-disc list-inside">
                {failedItems.slice(0, 5).map((f, i) => (
                  <li key={i}>{f.contact_id}: {f.error}</li>
                ))}
                {failedItems.length > 5 && (
                  <li>...and {failedItems.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Contacts Table */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold">
              Contacts ({contacts.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No contacts found. Import contacts from the Contacts page.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{selectedFramework.toUpperCase()} Score</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {contacts.slice(0, 50).map((contact) => {
                    const { score, tier } = getScoreForFramework(contact);
                    return (
                      <tr key={contact.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-sm text-gray-400">{contact.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{contact.company || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{contact.job_title || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {score !== undefined && score !== null ? (
                            <span className="font-mono font-bold text-lg">{score}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">{getTierBadge(tier)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {contacts.length > 50 && (
                <div className="p-4 text-center text-gray-400 border-t border-gray-700">
                  Showing 50 of {contacts.length} contacts
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
