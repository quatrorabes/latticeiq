// frontend/src/pages/ContactsPage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ContactsTable from '../components/ContactsTable';
import ContactDetailModal from '../components/ContactDetailModal';
import EnrichButton from '../components/EnrichButton';
import { apiClient } from '../services/apiClient';

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedinurl?: string;
  website?: string;
  vertical?: string;
  personatype?: string;
  enrichmentstatus: 'pending' | 'processing' | 'completed' | 'failed';
  enrichmentdata?: Record<string, any>;
  apexscore?: number;
  mdcpscore?: number;
  rssscore?: number;
  enrichedat?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch contacts on mount and when refreshKey changes
  useEffect(() => {
    fetchContacts();
  }, [refreshKey]);

  // Filter contacts based on search query
  useEffect(() => {
    const filtered = contacts.filter((contact) =>
      `${contact.firstname} ${contact.lastname} ${contact.email} ${contact.company || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
    setFilteredContacts(filtered);
  }, [contacts, searchQuery]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await apiClient.get('/api/v3/contacts?limit=1000');
      setContacts(response.data.contacts || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;

    try {
      await apiClient.delete(`/api/v3/contacts/${id}`);
      setContacts(contacts.filter((c) => c.id !== id));
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error deleting contact:', err);
      setError('Failed to delete contact');
    }
  };

  const handleEnrichComplete = () => {
    setRefreshKey((prev) => prev + 1);
    setIsModalOpen(false);
  };

  const handleBulkEnrich = async () => {
    const pendingContacts = contacts.filter((c) => c.enrichmentstatus === 'pending');
    if (pendingContacts.length === 0) {
      alert('No pending contacts to enrich');
      return;
    }

    try {
      setEnrichingId('bulk');
      await apiClient.post('/api/v3/crm/import/csv', {
        contacts: pendingContacts.map((c) => ({
          firstname: c.firstname,
          lastname: c.lastname,
          email: c.email,
          company: c.company,
          title: c.title,
        })),
      });
      
      // Refresh after a short delay
      setTimeout(() => {
        setRefreshKey((prev) => prev + 1);
        setEnrichingId(null);
      }, 2000);
    } catch (err) {
      console.error('Error bulk enriching:', err);
      setError('Failed to enrich contacts');
      setEnrichingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400 mt-2">{contacts.length} contacts total</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-900/20 border border-red-500 text-red-100 p-4 rounded">
            {error}
          </div>
        )}

        {/* Search & Actions */}
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={handleBulkEnrich}
            disabled={enrichingId !== null}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-6 py-2 rounded transition font-medium"
          >
            {enrichingId === 'bulk' ? 'Enriching...' : 'Bulk Enrich'}
          </button>
          <button
            onClick={fetchContacts}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded transition"
          >
            Refresh
          </button>
        </div>

        {/* Contacts Table */}
        <ContactsTable
          contacts={filteredContacts}
          onRowClick={handleRowClick}
          onDelete={handleDeleteContact}
        />

        {/* Contact Detail Modal */}
        {selectedContact && (
          <ContactDetailModal
            contact={selectedContact}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedContact(null);
            }}
            onEnrichComplete={handleEnrichComplete}
            onDelete={handleDeleteContact}
          />
        )}
      </div>
    </div>
  );
}
