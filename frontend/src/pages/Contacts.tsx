// frontend/src/pages/Contacts.tsx
import { useState, useEffect, useCallback } from 'react';
import type { Contact } from '../types/contact';
import { getContacts, deleteContact as deleteContactApi } from '../services/contactsService';
import ContactsTable from '../components/ContactsTable';
import ContactDetailModal from '../components/ContactDetailModal';
import Loader from '../components/Loader';

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getContacts();
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContact(null);
  };

  const handleEnrichComplete = () => {
    loadContacts();
  };

  const handleDelete = async (contactId: number) => {
    try {
      await deleteContactApi(contactId);
      setContacts(prev => prev.filter(c => c.id !== contactId));
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    const firstName = contact.first_name?.toLowerCase() || '';
    const lastName = contact.last_name?.toLowerCase() || '';
    const company = contact.company?.toLowerCase() || '';
    const email = contact.email?.toLowerCase() || '';
    const title = contact.title?.toLowerCase() || '';
    
    return (
      firstName.includes(query) ||
      lastName.includes(query) ||
      company.includes(query) ||
      email.includes(query) ||
      title.includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-6">
        <h3 className="text-red-400 font-semibold mb-2">Error Loading Contacts</h3>
        <p className="text-red-300">{error}</p>
        <button
          onClick={loadContacts}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Contacts</h1>
        <p className="text-gray-400 mt-1">{contacts.length} total contacts</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-96 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Contacts Table */}
      <ContactsTable
        contacts={filteredContacts}
        onRowClick={handleRowClick}
        onDelete={handleDelete}
      />

      {/* Contact Detail Modal */}
      <ContactDetailModal
        contact={selectedContact}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onEnrichComplete={handleEnrichComplete}
      />
    </div>
  );
}
