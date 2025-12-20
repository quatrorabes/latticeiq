import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Contact } from '../types/contact';
import ContactDetailModal from '../components/ContactDetailModal';
import { Zap, Trash2, Search, Plus } from 'lucide-react';

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  // Fetch contacts on mount
  useEffect(() => {
    fetchContacts();
  }, []);

  // Filter contacts on search term change
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = contacts.filter(contact =>
      contact.first_name.toLowerCase().includes(term) ||
      contact.last_name.toLowerCase().includes(term) ||
      contact.email.toLowerCase().includes(term) ||
      (contact.company && contact.company.toLowerCase().includes(term))
    );
    setFilteredContacts(filtered);
  }, [contacts, searchTerm]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError('Authentication failed');
        navigate('/login');
        return;
      }

      // Get JWT token
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError('Failed to get auth token');
        return;
      }

      // Fetch contacts from backend
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/contacts`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      const data = await response.json();

      // Handle both response formats
      const contactsArray = data.contacts || data;
      setContacts(Array.isArray(contactsArray) ? contactsArray : []);
      setFilteredContacts(Array.isArray(contactsArray) ? contactsArray : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching contacts:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickEnrich = async (contact: Contact) => {
    if (!contact.id) return;

    try {
      setEnrichingId(contact.id);

      // Get JWT token
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError('Failed to get auth token for enrichment');
        return;
      }

      // Call quick_enrich endpoint
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/enrichment/quick_enrich/${contact.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contact_id: contact.id,
            email: contact.email,
            first_name: contact.first_name,
            last_name: contact.last_name,
            company: contact.company,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Enrichment failed: ${response.status}`);
      }

      const enrichmentResult = await response.json();

      // Update the contact with enrichment data
      const updatedContact = {
        ...contact,
        enrichment_status: 'processing',
        enrichment_data: enrichmentResult,
      };

      // Update contacts list
      setContacts(contacts.map(c => (c.id === contact.id ? updatedContact : c)));
      setFilteredContacts(
        filteredContacts.map(c => (c.id === contact.id ? updatedContact : c))
      );

      // Show success
      console.log('✅ Quick enrichment started for:', contact.first_name, contact.last_name);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Enrichment failed';
      console.error('Error enriching contact:', errorMessage);
      setError(errorMessage);
    } finally {
      setEnrichingId(null);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      // Get JWT token
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError('Failed to get auth token');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/contacts/${contactId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }

      // Remove from UI
      setContacts(contacts.filter(c => c.id !== contactId));
      setFilteredContacts(filteredContacts.filter(c => c.id !== contactId));
      console.log('✅ Contact deleted');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Delete failed';
      console.error('Error deleting contact:', errorMessage);
      setError(errorMessage);
    }
  };

  const handleAddContact = () => {
    navigate('/contacts/new');
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string | undefined }) => {
    const statusColors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
      processing: 'bg-blue-500/20 text-blue-200 border-blue-500/30',
      completed: 'bg-green-500/20 text-green-200 border-green-500/30',
      failed: 'bg-red-500/20 text-red-200 border-red-500/30',
    };

    const color = statusColors[status || 'pending'] || statusColors.pending;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>
        {status || 'pending'}
      </span>
    );
  };

  // Score display
  const ScoreDisplay = ({ score }: { score?: number | null }) => {
    if (!score) return <span className="text-gray-500">—</span>;
    const color = score >= 75 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
    return <span className={`font-semibold ${color}`}>{Math.round(score)}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Contacts</h1>
              <p className="text-gray-400 mt-1">{filteredContacts.length} contacts</p>
            </div>
            <button
              onClick={handleAddContact}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <Plus size={18} />
              Add Contact
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/30 border-l-4 border-red-600 text-red-200 p-4 m-6">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Contacts table */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredContacts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <p className="text-gray-400 text-lg">
              {contacts.length === 0 ? 'No contacts yet' : 'No contacts match your search'}
            </p>
            {contacts.length === 0 && (
              <button
                onClick={handleAddContact}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <Plus size={18} />
                Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
            <table className="w-full">
              <thead className="bg-gray-700/50 border-b border-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Name</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Email</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Company</th>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-300">Title</th>
                  <th className="text-center px-6 py-3 text-sm font-semibold text-gray-300">Status</th>
                  <th className="text-center px-6 py-3 text-sm font-semibold text-gray-300">Score</th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredContacts.map(contact => (
                  <tr
                    key={contact.id}
                    className="hover:bg-gray-700/50 transition cursor-pointer"
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-white">
                        {contact.first_name} {contact.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{contact.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {contact.company || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {contact.title || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <StatusBadge status={contact.enrichment_status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <ScoreDisplay score={contact.apex_score} />
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleQuickEnrich(contact)}
                          disabled={enrichingId === contact.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-xs rounded transition"
                          title="Start quick enrichment"
                        >
                          {enrichingId === contact.id ? (
                            <>
                              <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
                              Enriching...
                            </>
                          ) : (
                            <>
                              <Zap size={14} />
                              Enrich
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs rounded transition border border-red-600/30 hover:border-red-600/50"
                          title="Delete contact"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onEnrich={() => {
            handleQuickEnrich(selectedContact);
            setSelectedContact(null);
          }}
        />
      )}
    </div>
  );
}
