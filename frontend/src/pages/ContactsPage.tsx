import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import type { Contact } from '../types/contact';
import ContactDetailModal from '../components/ContactDetailModal';

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // MODAL STATE
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check authentication
  useEffect(() => {
    supabase.auth.getSession().then((result) => {
      if (result.data.session) {
        setIsAuthenticated(true);
      } else {
        setIsLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, sess) => {
      setIsAuthenticated(!!sess);
      if (!sess) setIsLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch contacts when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchContacts();
    }
  }, [isAuthenticated]);

  // Filter contacts when search term or contacts change
  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm]);

  async function fetchContacts() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await supabase.auth.getSession();
      const session = result.data.session;

      if (!session) {
        setError('Not logged in');
        setIsLoading(false);
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v3/contacts`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching contacts');
    } finally {
      setIsLoading(false);
    }
  }

  function filterContacts() {
    const term = searchTerm.toLowerCase();
    setFilteredContacts(
      contacts.filter((c: Contact) =>
        c.first_name?.toLowerCase().includes(term) ||
        c.last_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term)
      )
    );
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return;

    try {
      const result = await supabase.auth.getSession();
      const session = result.data.session;

      if (!session) return;

      await fetch(`${import.meta.env.VITE_API_URL}/api/v3/contacts/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      setContacts(contacts.filter((c: Contact) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  // MODAL HANDLERS
  function openModal(contact: Contact) {
    setSelectedContact(contact);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setSelectedContact(null);
  }

  return (
    <div className="p-8 bg-slate-900 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-6">Contacts</h1>

      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-slate-800 text-white rounded px-4 py-2 border border-slate-700 mb-6"
      />

      {error && <div className="bg-red-900 text-red-100 p-4 rounded mb-6">{error}</div>}

      {isLoading ? (
        <p className="text-slate-400">Loading...</p>
      ) : filteredContacts.length === 0 ? (
        <p className="text-slate-400">No contacts</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800">
              <th className="text-left p-3 text-white">Name</th>
              <th className="text-left p-3 text-white">Email</th>
              <th className="text-left p-3 text-white">Company</th>
              <th className="text-left p-3 text-white">Score</th>
              <th className="text-left p-3 text-white">Status</th>
              <th className="text-left p-3 text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((c: Contact) => (
              <tr key={c.id} className="border-b border-slate-700 hover:bg-slate-800">
                {/* CLICKABLE ROW TO OPEN MODAL */}
                <td 
                  className="p-3 text-white cursor-pointer hover:text-blue-400"
                  onClick={() => openModal(c)}
                >
                  {c.first_name} {c.last_name}
                </td>
                <td 
                  className="p-3 text-slate-400 cursor-pointer hover:text-blue-400"
                  onClick={() => openModal(c)}
                >
                  {c.email}
                </td>
                <td 
                  className="p-3 text-slate-400 cursor-pointer hover:text-blue-400"
                  onClick={() => openModal(c)}
                >
                  {c.company || '-'}
                </td>
                <td 
                  className="p-3 text-white font-bold cursor-pointer hover:text-blue-400"
                  onClick={() => openModal(c)}
                >
                  {c.apex_score?.toFixed(0) || '-'}
                </td>
                <td 
                  className="p-3 text-slate-400 cursor-pointer hover:text-blue-400"
                  onClick={() => openModal(c)}
                >
                  {c.enrichment_status || 'pending'}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => openModal(c)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm mr-2"
                  >
                    View
                  </button>
                  <button
                    onClick={() => deleteContact(c.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* MODAL COMPONENT */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={isModalOpen}
          onClose={closeModal}
          onContactUpdate={(updated) => {
            setContacts(contacts.map((c) => (c.id === updated.id ? updated : c)));
            setSelectedContact(updated);
          }}
        />
      )}
    </div>
  );
}