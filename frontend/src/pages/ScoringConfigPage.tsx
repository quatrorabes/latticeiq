// frontend/src/pages/ScoringConfigPage.tsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email: string;
  company?: string;
  title?: string;
  job_title?: string;
  mdcp_score?: number;
  mdcp_tier?: string;
  bant_score?: number;
  bant_tier?: string;
  spice_score?: number;
  spice_tier?: string;
}

type Framework = 'mdcp' | 'bant' | 'spice';

export default function ScoringConfigPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<Framework>('mdcp');
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const location = useLocation();

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/contacts`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(data.contacts || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [location.key]);

  const scoreAllContacts = async () => {
    setScoring(true);
    setMessage(null);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/scoring/score-all?framework=${selectedFramework}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Scoring failed');
      }

      const result = await response.json();
      setMessage(`✅ ${result.message}`);
      
      // Refresh contacts to show updated scores
      await fetchContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  // Helper to get score based on selected framework
  const getScore = (contact: Contact): number | undefined => {
    switch (selectedFramework) {
      case 'mdcp': return contact.mdcp_score;
      case 'bant': return contact.bant_score;
      case 'spice': return contact.spice_score;
      default: return undefined;
    }
  };

  // Helper to get tier based on selected framework
  const getTier = (contact: Contact): string | undefined => {
    switch (selectedFramework) {
      case 'mdcp': return contact.mdcp_tier;
      case 'bant': return contact.bant_tier;
      case 'spice': return contact.spice_tier;
      default: return undefined;
    }
  };

  const getTierBadge = (tier: string | undefined) => {
    if (!tier) return <span className="text-gray-500">-</span>;
    const colors: Record<string, string> = {
      hot: 'bg-red-500 text-white',
      warm: 'bg-yellow-500 text-black',
      cold: 'bg-blue-500 text-white'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[tier] || 'bg-gray-500'}`}>
        {tier.toUpperCase()}
      </span>
    );
  };

  // Get display name - handle both name formats
  const getDisplayName = (contact: Contact) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    }
    return contact.name || contact.email.split('@')[0];
  };

  // Get title - handle both field names
  const getTitle = (contact: Contact) => {
    return contact.title || contact.job_title || '-';
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">⚙️ Scoring Configuration</h1>
      <p className="text-gray-400 mb-6">
        Customize how leads are qualified and prioritized. Set weights and thresholds for each framework.
      </p>

      <button
        onClick={fetchContacts}
        className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2"
      >
        🔄 Refresh
      </button>

      {/* Framework Tabs */}
      <div className="flex mb-6">
        {(['mdcp', 'bant', 'spice'] as Framework[]).map((fw) => (
          <button
            key={fw}
            onClick={() => setSelectedFramework(fw)}
            className={`flex-1 py-3 px-4 text-center ${
              selectedFramework === fw
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <div className="font-bold">{fw.toUpperCase()}</div>
            <div className="text-xs">
              {fw === 'mdcp' && 'Money, Decision-maker, Champion, Process'}
              {fw === 'bant' && 'Budget, Authority, Need, Timeline'}
              {fw === 'spice' && 'Situation, Problem, Implication, Critical Event, Decision'}
            </div>
          </button>
        ))}
      </div>

      {/* Score All Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">👥 Score All Contacts</h2>
        <p className="text-gray-400 mb-3">
          Apply {selectedFramework.toUpperCase()} scoring to all {contacts.length} contacts
        </p>
        <button
          onClick={scoreAllContacts}
          disabled={scoring || contacts.length === 0}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded flex items-center gap-2"
        >
          {scoring ? '⏳ Scoring...' : '▶️ Score All'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
          ⚠️ {error}
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded text-green-200">
          {message}
        </div>
      )}

      {/* Contacts Table */}
      <h2 className="text-lg font-semibold mb-3">📋 Contacts ({contacts.length})</h2>
      
      {loading ? (
        <p className="text-gray-400">Loading contacts...</p>
      ) : contacts.length === 0 ? (
        <p className="text-gray-400">No contacts found. Import contacts from the Contacts page.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-gray-700">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">{selectedFramework.toUpperCase()} Score</th>
                <th className="py-3 px-4">Tier</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const score = getScore(contact);
                const tier = getTier(contact);
                return (
                  <tr key={contact.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 px-4">
                      <div>{getDisplayName(contact)}</div>
                      <div className="text-sm text-gray-500">{contact.email}</div>
                    </td>
                    <td className="py-3 px-4">{contact.company || '-'}</td>
                    <td className="py-3 px-4">{getTitle(contact)}</td>
                    <td className="py-3 px-4">
                      {score !== undefined && score !== null ? (
                        <span className="font-mono font-bold text-lg">{score}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getTierBadge(tier)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
