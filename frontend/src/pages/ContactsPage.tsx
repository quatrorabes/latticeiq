import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import supabase from '../lib/supabaseClient';
import type { Contact } from '../types/contact';
import ContactDetailModal from '../components/ContactDetailModal';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface EnrichedContact extends Contact {
  enrichment_data?: {
    summary?: string;
    talking_points?: string[];
    hook?: string;
    objections?: string[];
    next_steps?: string[];
    bant?: {
      budget?: string;
      authority?: string;
      need?: string;
      timeline?: string;
    };
    spice?: {
      situation?: string;
      problem?: string;
      implication?: string;
      consequence?: string;
      decision?: string;
    };
  };
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
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    getSession();
  }, []);

  // Fetch contacts with CORS fix
  const fetchContacts = async () => {
    if (!session) {
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
        'Origin': window.location.origin,
      };

      const response = await fetch(`${API_BASE}/api/v3/contacts`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch contacts: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const contactsList = Array.isArray(data) ? data : data.contacts || [];
      
      setContacts(contactsList);
      setFilteredContacts(contactsList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch contacts';
      console.error('Error fetching contacts:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on session change
  useEffect(() => {
    if (session) {
      fetchContacts();
    }
  }, [session]);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const filtered = contacts.filter((contact) =>
      `${contact.first_name || ''} ${contact.last_name || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()) ||
      contact.email?.toLowerCase().includes(query.toLowerCase()) ||
      contact.company?.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredContacts(filtered);
  };

  // Handle modal open
  const openModal = (contact: EnrichedContact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  // Handle modal close
  const closeModal = () => {
    setSelectedContact(null);
    setIsModalOpen(false);
  };

  // Handle contact update
  const handleContactUpdate = (updated: EnrichedContact) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    setFilteredContacts((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    setSelectedContact(updated);
  };

  // Handle delete
  const handleDelete = async (contactId: string) => {
    if (!session) {
      alert('Not authenticated');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      const token = session.access_token;
      const headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Origin': window.location.origin,
      };

      const response = await fetch(`${API_BASE}/api/v3/contacts/${contactId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete contact: ${response.status}`);
      }

      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      setFilteredContacts((prev) => prev.filter((c) => c.id !== contactId));
      if (selectedContact?.id === contactId) {
        closeModal();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete contact';
      console.error('Error deleting contact:', message);
      alert(`Error: ${message}`);
    }
  };

  // Helper functions
  const asString = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const getStatusBadge = (status: string | undefined) => {
    const baseClass = 'px-3 py-1 rounded text-xs font-medium';
    switch (status?.toLowerCase()) {
      case 'completed':
        return `${baseClass} bg-green-500/20 text-green-300`;
      case 'processing':
        return `${baseClass} bg-blue-500/20 text-blue-300`;
      case 'failed':
        return `${baseClass} bg-red-500/20 text-red-300`;
      default:
        return `${baseClass} bg-gray-500/20 text-gray-300`;
    }
  };

  const getScoreTier = (score: number | undefined) => {
    if (!score) return '-';
    if (score >= 75) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Contacts</h1>
          <p className="text-gray-400">Manage and score your contacts</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded text-red-300">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border border-teal-500 border-t-transparent"></div>
          </div>
        )}

        {/* Contacts Table */}
        {!loading && (
          <div className="overflow-x-auto bg-gray-900 rounded border border-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">NAME</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">EMAIL</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">COMPANY</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">TITLE</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">MDCP</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">BANT</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">SPICE</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">STATUS</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      {contacts.length === 0
                        ? 'No contacts found. Import from CRM or CSV to get started.'
                        : 'No contacts match your search.'}
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition">
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => openModal(contact)}
                          className="text-teal-400 hover:text-teal-300"
                        >
                          {contact.first_name} {contact.last_name}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">{contact.email || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{contact.company || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">{contact.title || contact.job_title || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        {contact.mdcp_score ?? '-'}
                        {contact.mdcp_tier && <span className="ml-1 text-xs bg-blue-500/20 px-2 py-1 rounded">{contact.mdcp_tier.toUpperCase()}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {contact.bant_score ?? '-'}
                        {contact.bant_tier && <span className="ml-1 text-xs bg-green-500/20 px-2 py-1 rounded">{contact.bant_tier.toUpperCase()}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {contact.spice_score ?? '-'}
                        {contact.spice_tier && <span className="ml-1 text-xs bg-purple-500/20 px-2 py-1 rounded">{contact.spice_tier.toUpperCase()}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={getStatusBadge(contact.enrichment_status)}>
                          {contact.enrichment_status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen &&
        selectedContact &&
        createPortal(
          <ContactDetailModal
            contact={selectedContact}
            isOpen={isModalOpen}
            onClose={closeModal}
            onContactUpdate={handleContactUpdate}
            session={session}
          />,
          document.body
        )}
    </div>
  );
}
