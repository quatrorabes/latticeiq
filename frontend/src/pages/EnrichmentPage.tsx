// frontend/src/pages/EnrichmentPage.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  enrichment_status: string;
}

export default function EnrichmentPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company, enrichment_status')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const enrichContact = async (contactId: string) => {
    try {
      setEnriching(contactId);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/v3/enrich/${contactId}`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Enrichment failed');
      
      await fetchContacts();
    } catch (err) {
      console.error('Enrichment error:', err);
    } finally {
      setEnriching(null);
    }
  };

  const enrichAll = async () => {
    const pending = contacts.filter(c => c.enrichment_status !== 'enriched');
    for (const contact of pending) {
      await enrichContact(contact.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  const pendingCount = contacts.filter(c => c.enrichment_status !== 'enriched').length;
  const enrichedCount = contacts.filter(c => c.enrichment_status === 'enriched').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Enrichment</h1>
        <button
          onClick={enrichAll}
          disabled={pendingCount === 0}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Enrich All ({pendingCount})
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400">Enriched</p>
          <p className="text-2xl font-bold text-green-400">{enrichedCount}</p>
        </div>
      </div>

      {/* Contacts List */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="text-left px-4 py-3 text-gray-400">Name</th>
              <th className="text-left px-4 py-3 text-gray-400">Company</th>
              <th className="text-center px-4 py-3 text-gray-400">Status</th>
              <th className="text-center px-4 py-3 text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td className="px-4 py-3 text-white">
                  {contact.first_name} {contact.last_name}
                </td>
                <td className="px-4 py-3 text-gray-300">{contact.company || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    contact.enrichment_status === 'enriched'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {contact.enrichment_status || 'pending'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => enrichContact(contact.id)}
                    disabled={enriching === contact.id || contact.enrichment_status === 'enriched'}
                    className="text-cyan-400 hover:text-cyan-300 disabled:text-gray-500"
                  >
                    {enriching === contact.id ? 'Enriching...' : 'Enrich'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
