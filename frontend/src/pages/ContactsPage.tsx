// frontend/src/pages/ContactsPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Users, RefreshCw, Search, X } from 'lucide-react';
import ContactDetailModal from '../components/ContactDetailModal';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  job_title?: string;
  title?: string;
  phone?: string;
  linkedin_url?: string;
  vertical?: string;
  persona_type?: string;
  enrichment_status?: string;
  enrichment_data?: any;
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
  mdcp_tier?: string;
  bant_tier?: string;
  spice_tier?: string;
}

export default function ContactsPage() {
  const location = useLocation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Fetch contacts on mount
  useEffect(() => {
    fetchContacts();
  }, [location.key]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/v3/contacts`, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different response shapes
      if (Array.isArray(data)) {
        setContacts(data);
      } else if (data?.contacts && Array.isArray(data.contacts)) {
        setContacts(data.contacts);
      } else if (data?.data && Array.isArray(data.data)) {
        setContacts(data.data);
      } else {
        setContacts([]);
      }
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      setError(err.message || 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts by search term
  const filteredContacts = contacts.filter((contact) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      contact.first_name?.toLowerCase().includes(search) ||
      contact.last_name?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search) ||
      contact.company?.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status?: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      processing: 'bg-blue-500/20 text-blue-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs ${colors[status || 'pending'] || colors.pending}`}>
        {status || 'pending'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="w-8 h-8 text-cyan-400" />
              Contacts
            </h1>
            <p className="text-gray-400 mt-1">
              {contacts.length} contacts • Click a row to view details
            </p>
          </div>
          <button
            onClick={fetchContacts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading contacts...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              {searchTerm ? 'No contacts match your search' : 'No contacts found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Title</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">MDCP</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">BANT</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">SPICE</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className="hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{contact.first_name} {contact.last_name}</div>
                        <div className="text-sm text-gray-400">{contact.email || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{contact.company || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{contact.job_title || contact.title || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono">{contact.mdcp_score ?? '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono">{contact.bant_score ?? '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono">{contact.spice_score ?? '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(contact.enrichment_status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal - MUST be outside all containers for Portal to work */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={(updated) => {
            setContacts(contacts.map(c => c.id === updated.id ? updated : c));
            setSelectedContact(updated);
          }}
        />
      )}
    </div>
  );
}
