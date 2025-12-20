import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { contactsService } from '../services/contactsService';

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  company: string;
  title: string;
  phone?: string;
  enrichment_status: 'pending' | 'processing' | 'completed' | 'failed';
  apex_score?: number;
  enriched_at?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Load contacts
  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/contacts`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        setError('Failed to load contacts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger enrichment
  const handleEnrich = async (contactId: string) => {
    try {
      setEnrichingId(contactId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v3/enrichment/enrich`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contact_id: contactId, synthesize: true })
      });

      if (!response.ok) {
        throw new Error('Enrichment failed');
      }

      // Poll status
      let isComplete = false;
      let attempts = 0;
      while (!isComplete && attempts < 120) {
        await new Promise(r => setTimeout(r, 2000));
        
        const statusResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/v3/enrichment/${contactId}/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.status === 'completed' || status.status === 'failed') {
            isComplete = true;
          }
        }
        attempts++;
      }

      // Reload contacts
      await loadContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrichment error');
    } finally {
      setEnrichingId(null);
    }
  };

  // Delete contact
  const handleDelete = async (contactId: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        setContacts(contacts.filter(c => c.id !== contactId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Filter contacts
  const filteredContacts = contacts.filter(c =>
    `${c.firstname} ${c.lastname} ${c.email} ${c.company}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Contacts</h1>
        <p className="text-gray-600">Manage and enrich your sales contacts</p>
      </div>

      {/* Search & Stats */}
      <div className="mb-6 flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search by name, email, company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-sm text-gray-600">
          {filteredContacts.length} / {contacts.length} contacts
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-gray-600 text-sm">Total</div>
          <div className="text-2xl font-bold text-gray-900">{contacts.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-gray-600 text-sm">Pending</div>
          <div className="text-2xl font-bold text-gray-900">
            {contacts.filter(c => c.enrichment_status === 'pending').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-gray-600 text-sm">Enriched</div>
          <div className="text-2xl font-bold text-green-600">
            {contacts.filter(c => c.enrichment_status === 'completed').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-gray-600 text-sm">Failed</div>
          <div className="text-2xl font-bold text-red-600">
            {contacts.filter(c => c.enrichment_status === 'failed').length}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600">Loading...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-gray-600">No contacts found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Company</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Score</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {contact.firstname} {contact.lastname}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contact.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contact.company}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{contact.title}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(contact.enrichment_status)}`}>
                      {contact.enrichment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {contact.apex_score ? `${contact.apex_score}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    {contact.enrichment_status === 'pending' || contact.enrichment_status === 'failed' ? (
                      <button
                        onClick={() => handleEnrich(contact.id)}
                        disabled={enrichingId === contact.id}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                      >
                        {enrichingId === contact.id ? 'Enriching...' : 'Enrich'}
                      </button>
                    ) : null}
                    <button
                      onClick={() => setSelectedContact(contact)}
                      className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-xs font-semibold hover:bg-gray-300"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200"
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

      {/* Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedContact.firstname} {selectedContact.lastname}
              </h2>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase">Email</div>
                  <div className="text-sm text-gray-900 mt-1">{selectedContact.email}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase">Phone</div>
                  <div className="text-sm text-gray-900 mt-1">{selectedContact.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase">Company</div>
                  <div className="text-sm text-gray-900 mt-1">{selectedContact.company}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase">Title</div>
                  <div className="text-sm text-gray-900 mt-1">{selectedContact.title}</div>
                </div>
              </div>

              {/* Enrichment Status */}
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Enrichment Status</div>
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedContact.enrichment_status)}`}>
                    {selectedContact.enrichment_status}
                  </span>
                  {selectedContact.apex_score && (
                    <div>
                      <span className="text-gray-600 text-xs">APEX Score: </span>
                      <span className="text-xl font-bold text-gray-900">{selectedContact.apex_score}</span>
                    </div>
                  )}
                </div>
                {selectedContact.enriched_at && (
                  <div className="text-xs text-gray-600 mt-2">
                    Last updated: {new Date(selectedContact.enriched_at).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {selectedContact.enrichment_status === 'pending' || selectedContact.enrichment_status === 'failed' ? (
                  <button
                    onClick={() => {
                      handleEnrich(selectedContact.id);
                      setSelectedContact(null);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                  >
                    Enrich Contact
                  </button>
                ) : null}
                <button
                  onClick={() => setSelectedContact(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
