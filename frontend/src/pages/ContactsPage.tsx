import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';  // FIXED: Named import
import type { Contact } from '../types/contact';
import ContactDetailModal from '../components/ContactDetailModal';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface EnrichedContact extends Contact {
  enrichment_data?: any;
  enrichment_status?: string;
  mdcp_score?: number;
  mdcp_tier?: string;
  bant_score?: number;
  bant_tier?: string;
  spice_score?: number;
  spice_tier?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<EnrichedContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<EnrichedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<EnrichedContact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [session, setSession] = useState<any>(null);

  // Get session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  // Fetch contacts with CORS fix
  const fetchContacts = async () => {
    if (!session?.access_token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = session.access_token;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Origin': window.location.origin,  // CORS FIX
      };

      const response = await fetch(`${API_BASE}/api/v3/contacts`, {
        method: 'GET',
        headers,
        credentials: 'include',  // CORS FIX
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const contactsList = Array.isArray(data) ? data : data.contacts || [];
      setContacts(contactsList);
      setFilteredContacts(contactsList);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchContacts();
  }, [session]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const lowerQuery = query.toLowerCase();
    const filtered = contacts.filter(contact =>
      contact.first_name?.toLowerCase().includes(lowerQuery) ||
      contact.last_name?.toLowerCase().includes(lowerQuery) ||
      contact.email?.toLowerCase().includes(lowerQuery) ||
      contact.company?.toLowerCase().includes(lowerQuery)
    );
    setFilteredContacts(filtered);
  };

  const openModal = (contact: EnrichedContact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedContact(null);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;

    try {
      const token = session?.access_token;
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Origin': window.location.origin,
      };

      const res = await fetch(`${API_BASE}/api/v3/contacts/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Delete failed');

      setContacts(c => c.filter(contact => contact.id !== id));
      setFilteredContacts(c => c.filter(contact => contact.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStatusClass = (status?: string) => {
    const classes = {
      completed: 'bg-green-100 text-green-800',
      processing: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    return classes[status?.toLowerCase() as keyof typeof classes] || classes.pending!;
  };

  if (loading) return <div className="flex justify-center py-8">Loading...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Contacts ({contacts.length})</h1>
      
      <input
        type="text"
        placeholder="Search contacts..."
        value={searchQuery}
        onChange={e => handleSearch(e.target.value)}
        className="w-full max-w-md p-3 border rounded-lg mb-6"
      />

      <div className="overflow-x-auto">
        <table className="w-full bg-white border rounded-lg shadow">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-4 text-left">Name</th>
              <th className="p-4 text-left">Email</th>
              <th className="p-4 text-left">Company</th>
              <th className="p-4 text-left">Title</th>
              <th className="p-4 text-left">MDCP</th>
              <th className="p-4 text-left">BANT</th>
              <th className="p-4 text-left">SPICE</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map(contact => (
              <tr key={contact.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => openModal(contact)}>
                <td className="p-4 font-medium">{contact.first_name} {contact.last_name}</td>
                <td className="p-4">{contact.email || '-'}</td>
                <td className="p-4">{contact.company || '-'}</td>
                <td className="p-4">{contact.title || '-'}</td>
                <td className="p-4">{contact.mdcp_score || '-'}</td>
                <td className="p-4">{contact.bant_score || '-'}</td>
                <td className="p-4">{contact.spice_score || '-'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusClass(contact.enrichment_status)}`}>
                    {contact.enrichment_status || 'pending'}
                  </span>
                </td>
                <td className="p-4">
                  <button onClick={e => { e.stopPropagation(); handleDelete(contact.id!); }} className="text-red-600 hover:text-red-800">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedContact && createPortal(
        <ContactDetailModal
          contact={selectedContact}
          isOpen={true}
          onClose={closeModal}
        />,
        document.body
      )}
    </div>
  );
}
