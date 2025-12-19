'use client';

import { useState, useEffect } from 'react';

import { supabase } from '../lib/supabase';
import { ContactDetailModal } from '../components/ContactDetailModal';

interface Contact {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  company: string;
  title: string;
  apex_score?: number;
  enrichment_status?: string;
  enrichment_data?: any;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, enriched: 0, companies: 0 });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContacts(data || []);
      
      // Calculate stats
      const enriched = (data || []).filter(
        (c) => c.enrichment_status === 'enriched'
      ).length;
      const companies = new Set((data || []).map((c) => c.company)).size;
      
      setStats({
        total: (data || []).length,
        enriched,
        companies,
      });
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'enriched':
        return 'bg-green-900 text-green-200';
      case 'enriching':
        return 'bg-blue-900 text-blue-200';
      case 'failed':
        return 'bg-red-900 text-red-200';
      default:
        return 'bg-gray-700 text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Contacts</h1>
          <p className="text-gray-400">Manage and enrich your sales contacts</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div>
            <p className="text-gray-400 text-sm uppercase">Total Contacts</p>
            <p className="text-3xl font-bold text-white">{stats.total}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm uppercase">Enriched</p>
            <p className="text-3xl font-bold text-green-400">{stats.enriched}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm uppercase">Companies</p>
            <p className="text-3xl font-bold text-blue-400">{stats.companies}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No contacts yet. Import some to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800">
                    <th className="text-left p-4 text-gray-300 font-semibold">
                      Contact
                    </th>
                    <th className="text-left p-4 text-gray-300 font-semibold">
                      Company
                    </th>
                    <th className="text-left p-4 text-gray-300 font-semibold">
                      Title
                    </th>
                    <th className="text-left p-4 text-gray-300 font-semibold">
                      APEX Score
                    </th>
                    <th className="text-left p-4 text-gray-300 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      onClick={() => handleRowClick(contact)}
                      className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition"
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-semibold text-white">
                            {contact.firstname} {contact.lastname}
                          </p>
                          <p className="text-sm text-gray-400">{contact.email}</p>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300">{contact.company || '—'}</td>
                      <td className="p-4 text-gray-300">{contact.title || '—'}</td>
                      <td className="p-4">
                        {contact.apex_score ? (
                          <span className="inline-block px-3 py-1 bg-purple-900 text-purple-200 rounded font-bold">
                            {contact.apex_score}
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-block px-3 py-1 rounded text-sm capitalize ${getStatusColor(
                            contact.enrichment_status || 'pending'
                          )}`}
                        >
                          {contact.enrichment_status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <ContactDetailModal
        contact={selectedContact}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedContact(null);
        }}
      />
    </div>
  );
}
