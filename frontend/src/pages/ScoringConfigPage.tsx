// frontend/src/pages/ScoringConfigPage.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  company?: string;
  title?: string;
  mdcp_score?: number;
  mdcp_tier?: string;
  bant_score?: number;
  bant_tier?: string;
  spice_score?: number;
  spice_tier?: string;
}

export default function ScoringConfigPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [framework, setFramework] = useState<'mdcp' | 'bant' | 'spice'>('mdcp');
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch contacts
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessage('❌ Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/contacts`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      const data = await response.json();
      setContacts(data.contacts || data || []);
      setMessage(null);
    } catch (err) {
      setMessage(`❌ Failed to load contacts: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Score all contacts
  const scoreAllContacts = async () => {
    setScoring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessage('❌ Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/scoring/score-all?framework=${framework}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      const result = await response.json();
      setMessage(`✅ ${result.message}`);
      
      // Refresh to show scores
      await new Promise(r => setTimeout(r, 500));
      await fetchContacts();
    } catch (err) {
      setMessage(`❌ Scoring failed: ${err}`);
    } finally {
      setScoring(false);
    }
  };

  const getScore = (contact: Contact) => {
    return framework === 'mdcp' ? contact.mdcp_score : 
           framework === 'bant' ? contact.bant_score : 
           contact.spice_score;
  };

  const getTier = (contact: Contact) => {
    return framework === 'mdcp' ? contact.mdcp_tier : 
           framework === 'bant' ? contact.bant_tier : 
           contact.spice_tier;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">⚙️ Scoring Configuration</h1>

      <div className="flex gap-4 mb-6">
        {(['mdcp', 'bant', 'spice'] as const).map(fw => (
          <button
            key={fw}
            onClick={() => setFramework(fw)}
            className={`px-4 py-2 rounded font-bold ${
              framework === fw ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            {fw.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        onClick={scoreAllContacts}
        disabled={scoring}
        className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded font-bold mb-6"
      >
        {scoring ? '⏳ Scoring...' : `▶️ Score All (${contacts.length})`}
      </button>

      {message && (
        <div className="mb-4 p-3 bg-gray-800 rounded border border-blue-500">
          {message}
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Company</th>
                <th className="py-2">Title</th>
                <th className="py-2">Score</th>
                <th className="py-2">Tier</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => {
                const score = getScore(c);
                const tier = getTier(c);
                return (
                  <tr key={c.id} className="border-b">
                    <td className="py-2">{c.first_name} {c.last_name}</td>
                    <td>{c.company || '-'}</td>
                    <td>{c.title || '-'}</td>
                    <td className="font-bold text-lg">{score || '-'}</td>
                    <td>
                      {tier ? (
                        <span className={`px-2 py-1 rounded text-xs ${
                          tier === 'hot' ? 'bg-red-600' :
                          tier === 'warm' ? 'bg-yellow-600' :
                          'bg-blue-600'
                        }`}>
                          {tier.toUpperCase()}
                        </span>
                      ) : '-'}
                    </td>
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
