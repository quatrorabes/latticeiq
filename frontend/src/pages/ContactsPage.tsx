// frontend/src/pages/ContactsPage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ContactDetailModal from '../components/ContactDetailModal';
import type { Contact } from '../types/contact';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

// Extend the base Contact type with the additional fields we use
interface ContactWithScores extends Contact {
  job_title?: string;
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithScores[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactWithScores[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  // Filter whenever contacts, search, or status changes
  useEffect(() => {
    let filtered = contacts;

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((c) => c.enrichment_status === selectedStatus);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((c) =>
        c.first_name.toLowerCase().includes(term) ||
        c.last_name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.company && c.company.toLowerCase().includes(term))
      );
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, selectedStatus]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/v3/contacts`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(data.contacts || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-gray-400';
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-900 text-green-300 rounded">Enriched</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-yellow-900 text-yellow-300 rounded">Pending</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs bg-blue-900 text-blue-300 rounded">Processing</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">Not Enriched</span>;
    }
  };

  // Summary stats
  const stats = {
    total: contacts.length,
    enriched: contacts.filter((c) => c.enrichment_status === 'completed').length,
    pending: contacts.filter((c) => c.enrichment_status === 'pending').length,
    avgScore: contacts.length > 0
      ? Math.round(
          contacts.reduce((sum, c) => sum + (c.mdcp_score || 0), 0) / contacts.length
        )
      : 0,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Contacts</h1>
          <p className="text-gray-400">
            Import from CSV, HubSpot, Salesforce, or Pipedrive, then enrich and score.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Contacts" value={stats.total} />
          <StatCard label="Enriched" value={stats.enriched} accent="text-green-400" />
          <StatCard label="Pending" value={stats.pending} accent="text-yellow-400" />
          <StatCard label="Avg Score" value={stats.avgScore} accent="text-cyan-400" />
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-800 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600"
          />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-gray-800 rounded text-white focus:outline-none focus:border-cyan-600"
          >
            <option value="all">All Status</option>
            <option value="completed">Enriched</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
            <p className="text-gray-400 mt-4">Loading contacts...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No contacts found.</p>
            <p className="text-sm text-gray-500">
              {contacts.length === 0
                ? 'Import contacts from your CRM to get started.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-800 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Company</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Title</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">MDCP</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">BANT</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">SPICE</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="hover:bg-gray-900 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className="font-medium">
                        {contact.first_name} {contact.last_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      <a
                        href={`mailto:${contact.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-cyan-400 transition"
                      >
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{contact.company || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{contact.job_title || contact.title || '-'}</td>
                    <td className={`px-4 py-3 text-sm text-center font-semibold ${getScoreColor(contact.mdcp_score)}`}>
                      {contact.mdcp_score ?? '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm text-center font-semibold ${getScoreColor(contact.bant_score)}`}>
                      {contact.bant_score ?? '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm text-center font-semibold ${getScoreColor(contact.spice_score)}`}>
                      {contact.spice_score ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">{getStatusBadge(contact.enrichment_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Result count */}
        {!loading && (
          <p className="text-sm text-gray-400 mt-4">
            Showing {filteredContacts.length} of {contacts.length} contacts
          </p>
        )}
      </div>

      {/* Contact Detail Modal */}
      <ContactDetailModal
        contact={selectedContact}
        isOpen={selectedContact !== null}
        onClose={() => setSelectedContact(null)}
      />
    </div>
  );
}

function StatCard({ label, value, accent = 'text-cyan-400' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}
        