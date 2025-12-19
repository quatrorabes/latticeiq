// frontend/src/components/ContactsTable.tsx
import { useState, useEffect, useCallback } from 'react';
import type { Contact } from '../types/contact';
import { getContacts, deleteContact } from '../services/contactsService';
import ContactDetailModal from './ContactDetailModal';
import Loader from './Loader';

export default function ContactsTable() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContacts();
      setContacts(data);
      setFilteredContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(contact =>
      (contact.first_name?.toLowerCase() || '').includes(query) ||
      (contact.last_name?.toLowerCase() || '').includes(query) ||
      (contact.email?.toLowerCase() || '').includes(query) ||
      (contact.company?.toLowerCase() || '').includes(query)
    );
    setFilteredContacts(filtered);
  }, [searchQuery, contacts]);

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const handleDeleteContact = async (id: number | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === undefined) return; 
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      await deleteContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  };

  const getDisplayName = (contact: Contact) => {
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    }
    return contact.email;
  };

  const getInitials = (contact: Contact) => {
    const first = contact.first_name?.[0] || '';
    const last = contact.last_name?.[0] || '';
    return (first + last).toUpperCase() || contact.email?.[0]?.toUpperCase() || '?';
  };

  const getScoreBadge = (score?: number | null) => {
    if (!score) return 'bg-gray-700 text-gray-400';
    if (score >= 75) return 'bg-green-900/50 text-green-400';
    if (score >= 50) return 'bg-yellow-900/50 text-yellow-400';
    return 'bg-red-900/50 text-red-400';
  };

  const getStatusBadge = (status?: string | null) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-700 text-gray-300',
      processing: 'bg-blue-900/50 text-blue-400',
      completed: 'bg-green-900/50 text-green-400',
      failed: 'bg-red-900/50 text-red-400'
    };
    return styles[status || 'pending'] || styles.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Contacts</h1>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">APEX</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredContacts.map((contact) => (
              <tr
                key={contact.id ?? contact.email}
                onClick={() => handleRowClick(contact)}
                className="hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-medium">
                      {getInitials(contact)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{getDisplayName(contact)}</p>
                      <p className="text-gray-400 text-sm">{contact.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-300">{contact.company || '—'}</td>
                <td className="px-6 py-4 text-gray-300">{contact.title || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreBadge(contact.apex_score)}`}>
                    {contact.apex_score ?? '—'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusBadge(contact.enrichment_status)}`}>
                    {contact.enrichment_status || 'pending'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={(e) => handleDeleteContact(contact.id, e)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredContacts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {searchQuery ? 'No contacts match your search' : 'No contacts yet'}
          </div>
        )}
      </div>

      <ContactDetailModal
        contact={selectedContact}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEnrichComplete={() => {
          setIsModalOpen(false);
          loadContacts();
        }}
      />
    </div>
  );
}
