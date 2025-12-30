// frontend/src/pages/ScoringConfigPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings2, RefreshCw, Users, Play, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  job_title?: string;
  title?: string;
  mdcp_score?: number;
  mdcp_tier?: string;
  bant_score?: number;
  bant_tier?: string;
  spice_score?: number;
  spice_tier?: string;
  enrichment_status?: string;
}

interface FrameworkConfig {
  framework: string;
  weights: Record<string, number>;
  thresholds: { hotMin: number; warmMin: number };
  config?: Record<string, any>;
}

const FRAMEWORK_INFO = {
  mdcp: {
    name: 'MDCP',
    description: 'Money, Decision-maker, Champion, Process',
    detail: 'Best for straightforward enterprise sales with clear budget and decision-makers.'
  },
  bant: {
    name: 'BANT',
    description: 'Budget, Authority, Need, Timeline',
    detail: 'Industry standard for enterprise sales qualification with detailed criteria.'
  },
  spice: {
    name: 'SPICE',
    description: 'Situation, Problem, Implication, Critical Event, Decision',
    detail: 'Best for complex solutions with multiple stakeholders.'
  }
};

export default function ScoringConfigPage() {
  const { session } = useAuth();
  const [selectedFramework, setSelectedFramework] = useState<'mdcp' | 'bant' | 'spice'>('mdcp');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [scoringResult, setScoringResult] = useState<any>(null);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    if (!session?.access_token) {
      setContactsError('Not authenticated');
      return;
    }

    setContactsLoading(true);
    setContactsError(null);

    try {
      const response = await fetch(`${API_URL}/api/v3/contacts`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
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
        console.warn('Unexpected contacts response shape:', data);
        setContacts([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch contacts:', err);
      setContactsError(err.message || 'Failed to fetch contacts');
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, [session?.access_token]);

  // Fetch contacts on mount
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Score all contacts
  const handleScoreAll = async () => {
    if (!session?.access_token) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setScoringResult(null);

    try {
      const response = await fetch(`${API_URL}/api/v3/scoring/score-all?framework=${selectedFramework}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      setScoringResult(result);
      
      // Refresh contacts to show updated scores
      await fetchContacts();
    } catch (err: any) {
      console.error('Scoring failed:', err);
      setError(err.message || 'Scoring failed');
    } finally {
      setLoading(false);
    }
  };

  // Get score and tier for a contact based on selected framework
  const getContactScore = (contact: Contact) => {
    switch (selectedFramework) {
      case 'mdcp':
        return { score: contact.mdcp_score, tier: contact.mdcp_tier };
      case 'bant':
        return { score: contact.bant_score, tier: contact.bant_tier };
      case 'spice':
        return { score: contact.spice_score, tier: contact.spice_tier };
      default:
        return { score: undefined, tier: undefined };
    }
  };

  // Tier badge component
  const getTierBadge = (tier?: string) => {
    if (!tier) return <span className="text-gray-500">-</span>;
    
    const colors: Record<string, string> = {
      hot: 'bg-red-500 text-white',
      warm: 'bg-yellow-500 text-black',
      cold: 'bg-blue-500 text-white'
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[tier] || 'bg-gray-500 text-white'}`}>
        {tier.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="w-6 h-6" />
          Scoring Configuration
        </h1>
        <p className="text-gray-400 mt-1">
          Customize how leads are qualified and prioritized. Set weights and thresholds for each framework.
        </p>
      </div>

      {/* Refresh Button */}
      <button
        onClick={fetchContacts}
        disabled={contactsLoading}
        className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${contactsLoading ? 'animate-spin' : ''}`} />
        Refresh
      </button>

      {/* Framework Tabs */}
      <div className="flex gap-0 mb-6">
        {Object.entries(FRAMEWORK_INFO).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setSelectedFramework(key as 'mdcp' | 'bant' | 'spice')}
            className={`flex-1 p-4 text-center transition-colors ${
              selectedFramework === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            <div className="font-bold">{info.name}</div>
            <div className="text-sm opacity-80">{info.description}</div>
            <div className="text-xs mt-1 opacity-60">{info.detail}</div>
          </button>
        ))}
      </div>

      {/* Score All Section */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <Users className="w-5 h-5" />
          Score All Contacts
        </h2>
        <p className="text-gray-400 mb-4">
          Apply {selectedFramework.toUpperCase()} scoring to all {contacts.length} contacts
        </p>
        
        <button
          onClick={handleScoreAll}
          disabled={loading || contacts.length === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          {loading ? 'Scoring...' : 'Score All'}
        </button>

        {/* Scoring Result */}
        {scoringResult && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-600 rounded">
            <p className="text-green-400">
              ✅ {scoringResult.message || `Scored ${scoringResult.scored}/${scoringResult.total} contacts`}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Contacts Error */}
      {contactsError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-red-400">{contactsError}</p>
        </div>
      )}

      {/* Contacts Table */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5" />
          Contacts ({contacts.length})
        </h2>

        {contactsLoading ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No contacts found. Import contacts from the Contacts page.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Company</th>
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">{selectedFramework.toUpperCase()} Score</th>
                  <th className="pb-2">Tier</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const { score, tier } = getContactScore(contact);
                  return (
                    <tr key={contact.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 pr-4">
                        <div className="font-medium">
                          {contact.first_name} {contact.last_name}
                        </div>
                        <div className="text-sm text-gray-400">{contact.email}</div>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{contact.company || '-'}</td>
                      <td className="py-3 pr-4 text-gray-300">{contact.job_title || contact.title || '-'}</td>
                      <td className="py-3 pr-4">
                        {score !== undefined && score !== null ? (
                          <span className="font-mono">{score}</span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-3">{getTierBadge(tier)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
