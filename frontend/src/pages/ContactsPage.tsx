// frontend/src/pages/ContactsPage.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import ContactDetailModal from '../components/ContactDetailModal';
import AddContactModal from '../components/AddContactModal';

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.first_name?.toLowerCase().includes(searchLower) ||
      contact.last_name?.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.company?.toLowerCase().includes(searchLower)
    );
  });

  const getScoreBadge = (score: number | undefined) => {
    if (!score) return <span className="text-gray-500">-</span>;
    const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
    return <span className={color}>{score}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Contacts</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          + Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Contacts Table */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No contacts yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 text-cyan-400 hover:text-cyan-300"
          >
            + Add Your First Contact
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Company</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">MDCP</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">BANT</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredContacts.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className="hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-white">
                    {contact.first_name} {contact.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{contact.company || '-'}</td>
                  <td className="px-4 py-3 text-gray-300">{contact.email}</td>
                  <td className="px-4 py-3 text-center">{getScoreBadge(contact.mdcp_score)}</td>
                  <td className="px-4 py-3 text-center">{getScoreBadge(contact.bant_score)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      contact.enrichment_status === 'enriched' 
                        ? 'bg-green-900/50 text-green-400' 
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {contact.enrichment_status || 'pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={fetchContacts}
        />
      )}

      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onAdd={fetchContacts}
        />
      )}
    </div>
  );
}
