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
      const authData = await supabase.auth.getSession();
      const session = authData.data.session;
      if (!session) {
        throw new Error('Not authenticated');
      }
      const url = `${import.meta.env.VITE_API_URL}/api/v3/contacts`;
      const headers = { 'Authorization': `Bearer ${session.access_token}` };
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      const data = await response.json();
      const contactList = data.contacts || data || [];
      setContacts(contactList);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error loading contacts';
      setError(msg);
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterContacts = () => {
    const term = searchTerm.toLowerCase();
    const filtered = contacts.filter((c) => {
      const firstName = c.first_name?.toLowerCase() || '';
      const lastName = c.last_name?.toLowerCase() || '';
      const email = c.email?.toLowerCase() || '';
      const company = c.company?.toLowerCase() || '';
      return firstName.includes(term) || lastName.includes(term) || email.includes(term) || company.includes(term);
    });
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

  const handleDeleteContact = async (contactId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!confirm('Delete this contact?')) {
      return;
    }
    try {
      const authData = await supabase.auth.getSession();
      const session = authData.data.session;
      if (!session) {
        throw new Error('Not authenticated');
      }
      const url = `${import.meta.env.VITE_API_URL}/api/v3/contacts/${contactId}`;
      const headers = { 'Authorization': `Bearer ${session.access_token}` };
      const response = await fetch(url, { method: 'DELETE', headers });
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }
      const filtered = contacts.filter((c) => c.id !== contactId);
      setContacts(filtered);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
      console.error('Delete error:', err);
    }
  };

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:border-blue-500 outline-none"
        />
      </div>

      {error && (
        <div className="mb-6 bg-red-900 text-red-100 p-4 rounded-lg flex justify-between items-center">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="text-red-300">X</button>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full mb-4"></div>
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
                <th className="px-6 py-4 text-left font-semibold">Name</th>
                <th className="px-6 py-4 text-left font-semibold">Email</th>
                <th className="px-6 py-4 text-left font-semibold">Company</th>
                <th className="px-6 py-4 text-left font-semibold">Job Title</th>
                <th className="px-6 py-4 text-left font-semibold">Score</th>
                <th className="px-6 py-4 text-left font-semibold">Status</th>
                <th className="px-6 py-4 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-slate-700 hover:bg-slate-700 cursor-pointer"
                  onClick={() => handleRowClick(contact)}
                >
                  <td className="px-6 py-4 text-white">{contact.first_name} {contact.last_name}</td>
                  <td className="px-6 py-4 text-slate-400">{contact.email}</td>
                  <td className="px-6 py-4 text-slate-400">{contact.company || 'N/A'}</td>
                  <td className="px-6 py-4 text-slate-400">{contact.job_title || 'N/A'}</td>
                  <td className={`px-6 py-4 font-bold ${getScoreColor(contact.apex_score)}`}>
                    {contact.apex_score?.toFixed(0) || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusBadge(contact.enrichment_status)}`}>
                      {contact.enrichment_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => handleDeleteContact(contact.id, e)}
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
          <p className="text-slate-400 text-sm">Total Contacts</p>
          <p className="text-3xl font-bold text-white mt-2">{contacts.length}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Enriched</p>
          <p className="text-3xl font-bold text-green-500 mt-2">
            {contacts.filter((c) => c.enrichment_status === 'completed').length}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Avg APEX</p>
          <p className="text-3xl font-bold text-blue-500 mt-2">
            {contacts.length > 0 
              ? (contacts.filter((c) => c.apex_score).reduce((s, c) => s + (c.apex_score || 0), 0) / contacts.length).toFixed(0)
              : 'N/A'}
          </p>
        </div>
      </div>

      {isModalOpen && selectedContact && (
        <ContactDetailModalPremium
          contact={selectedContact}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onEnrichComplete={() => fetchContacts()}
          onContactUpdate={(c) => setContacts(contacts.map((x) => x.id === c.id ? c : x))}
        />
      )}
    </div>
  );
}
