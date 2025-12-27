// frontend/src/pages/ContactsPage.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ContactDetailModalPremium } from '../components/ContactDetailModalPremium';
import type { Contact } from '../types/contact';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm]);

  const fetchContacts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v2/contacts?limit=100&offset=0`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(data.contacts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const filterContacts = () => {
    const term = searchTerm.toLowerCase();
    const filtered = contacts.filter(
      (c) =>
        c.first_name?.toLowerCase().includes(term) ||
        c.last_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.company?.toLowerCase().includes(term)
    );
    setFilteredContacts(filtered);
  };

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContact(null);
  };

  const handleEnrichComplete = () => {
    fetchContacts();
  };

  const handleContactUpdate = (updatedContact: Contact) => {
    setContacts(contacts.map(c => c.id === updatedContact.id ? updatedContact : c));
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      await fetch(
        `${import.meta.env.VITE_API_URL}/api/v2/contacts/${contactId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );
      setContacts(contacts.filter(c => c.id !== contactId));
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return 'text-gray-500';
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Contacts</h1>
        <p className="text-slate-400">Manage and enrich your sales contacts</p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="mb-6 bg-red-900 text-red-100 p-4 rounded-lg flex justify-between items-center">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100">
            ✕
          </button>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin mb-4 inline-block">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-slate-400">Loading contacts...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">No contacts found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-700">
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Name</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Email</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Company</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Title</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">APEX Score</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(contact)}
                >
                  <td className="px-6 py-4 text-white font-medium">
                    {contact.first_name} {contact.last_name}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{contact.email}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{contact.company || '—'}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{contact.title || '—'}</td>
                  <td className={`px-6 py-4 font-bold text-sm ${getScoreColor(contact.apex_score)}`}>
                    {contact.apex_score?.toFixed(0) || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${getStatusBadge(contact.enrichment_status)}`}>
                      {contact.enrichment_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteContact(contact.id);
                      }}
                      className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm uppercase tracking-wide">Total Contacts</p>
          <p className="text-3xl font-bold text-white mt-2">{contacts.length}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm uppercase tracking-wide">Enriched</p>
          <p className="text-3xl font-bold text-green-500 mt-2">
            {contacts.filter(c => c.enrichment_status === 'completed').length}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm uppercase tracking-wide">Avg APEX Score</p>
          <p className="text-3xl font-bold text-blue-500 mt-2">
            {(contacts.filter(c => c.apex_score).reduce((sum, c) => sum + (c.apex_score || 0), 0) / (contacts.length || 1)).toFixed(0)}
          </p>
        </div>
      </div>

      <ContactDetailModalPremium
        contact={selectedContact}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onEnrichComplete={handleEnrichComplete}
        onContactUpdate={handleContactUpdate}
      />
    </div>
  );
}
