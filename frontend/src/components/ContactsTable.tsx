import { useState, useEffect } from 'react';
import { contactsService } from '../services/contactsService';
import { Contact } from '../types/contact';
import { ContactDetailModal } from './ContactDetailModal';
import { Loader } from './Loader';

export const ContactsTable: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await contactsService.getContacts();
      setContacts(data);
      setFilteredContacts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load contacts'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const filtered = contacts.filter(contact => {
      const searchTerm = query.toLowerCase();
      return (
        contact.first_name?.toLowerCase().includes(searchTerm) ||
        contact.last_name?.toLowerCase().includes(searchTerm) ||
        contact.email?.toLowerCase().includes(searchTerm) ||
        contact.company?.toLowerCase().includes(searchTerm)
      );
    });
    setFilteredContacts(filtered);
  };

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const handleDeleteContact = async (contactId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await contactsService.deleteContact(contactId);
        setContacts(contacts.filter(c => c.id !== contactId));
        setFilteredContacts(filteredContacts.filter(c => c.id !== contactId));
      } catch (err) {
        console.error('Failed to delete contact:', err);
      }
    }
  };

  const getInitials = (contact: Contact): string => {
    const first = contact.first_name?.[0] || '';
    const last = contact.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const getDisplayName = (contact: Contact): string => {
    const first = contact.first_name || '';
    const last = contact.last_name || '';
    return `${first} ${last}`.trim() || 'Unknown';
  };

  const getScoreBadge = (score: number | undefined) => {
    if (score === undefined || score === null) return '—';
    if (score >= 80) return <span className="text-green-600 font-semibold">{score}</span>;
    if (score >= 60) return <span className="text-yellow-600 font-semibold">{score}</span>;
    return <span className="text-red-600 font-semibold">{score}</span>;
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return <span className="text-gray-500">Pending</span>;
    const statusStyles: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      processing: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    const style = statusStyles[status] || 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 rounded text-xs font-medium ${style}`}>{status}</span>;
  };

  if (loading) return <Loader />;

  if (error) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-red-600 mb-2">Failed to load contacts</h3>
        <p className="text-gray-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">CONTACT</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">COMPANY</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">TITLE</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">APEX</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">STATUS</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center px-4 py-6 text-gray-400">
                  No contacts found {searchQuery ? 'Try a different search' : 'Add or import contacts to get started'}
                </td>
              </tr>
            ) : (
              filteredContacts.map(contact => (
                <tr
                  key={contact.id}
                  onClick={() => handleRowClick(contact)}
                  className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer transition"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-semibold text-white">
                        {getInitials(contact)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{getDisplayName(contact)}</p>
                        <p className="text-xs text-gray-400">{contact.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">{contact.company || '—'}</td>
                  <td className="px-4 py-4 text-sm text-gray-300">{contact.title || '—'}</td>
                  <td className="px-4 py-4 text-sm">{getScoreBadge(contact.apex_score ?? undefined)}</td>
                  <td className="px-4 py-4 text-sm">{getStatusBadge(contact.enrichment_status)}</td>
                  <td className="px-4 py-4 text-sm">
                    <button
                      onClick={e => handleDeleteContact(contact.id, e)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete contact"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Component */}
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
};

export default ContactsTable;