// ============================================================================
// FILE: frontend/src/pages/ContactsPage.tsx
// PURPOSE: Contacts list with scoring display + modal + enrichment
// UPDATED: Dec 29, 2025 - Fix "undefined.map" crashes for BANT/SPICE + talking points
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  job_title?: string;
  linkedin_url?: string;
  vertical?: string;
  enrichment_status?: string;
  enrichment_data?: any;
  apex_score?: number;
  mdcp_score?: number;
  mdcp_tier?: string;
  bant_score?: number;
  bant_tier?: string;
  spice_score?: number;
  spice_tier?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

function safeArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const getTierColor = (tier: string | undefined) => {
  if (!tier) return 'bg-gray-100 text-gray-600';
  const t = tier.toLowerCase();
  if (t === 'hot') return 'bg-red-500 text-white';
  if (t === 'warm') return 'bg-yellow-400 text-gray-900';
  return 'bg-gray-200 text-gray-700';
};

const getStatusColor = (status: string | undefined) => {
  if (!status) return 'bg-gray-100 text-gray-600';
  const s = status.toLowerCase();
  if (s === 'completed') return 'bg-green-100 text-green-800';
  if (s === 'processing') return 'bg-blue-100 text-blue-800';
  if (s === 'failed') return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
};

// ============================================================================
// CONTACT DETAIL MODAL
// ============================================================================

interface ContactDetailModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdate: (contact: Contact) => void;
}

function ContactDetailModal({ contact, isOpen, onClose, onContactUpdate }: ContactDetailModalProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Normalize enrichment_data so UI never assumes structure exists
  const enrichment = contact.enrichment_data || {};
  const talkingPoints = safeArray<string>(enrichment.talking_points || enrichment.talkingPoints);
  const objections = safeArray<string>(enrichment.objections);
  const hooks = safeArray<string>(enrichment.hooks);
  const nextSteps = safeArray<string>(enrichment.next_steps || enrichment.nextSteps);

  const bant = enrichment.bant || {};
  const spice = enrichment.spice || {};

  // These often come back as arrays OR missing OR a string. Never map raw.
  const bantSignals = safeArray<string>(bant.signals || bant.signal_list || bant.points);
  const spiceSignals = safeArray<string>(spice.signals || spice.signal_list || spice.points);

  const handleEnrich = async () => {
    setIsEnriching(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      // IMPORTANT: keep endpoint consistent with your backend
      const res = await fetch(`${API_URL}/api/v3/enrich/${contact.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Enrichment failed: ${res.status}`);
      }

      const data = await res.json();

      // Merge and preserve existing fields; ensure status aligns with DB constraint values
      const nextStatus =
        data.enrichment_status === 'completed' ||
        data.enrichment_status === 'processing' ||
        data.enrichment_status === 'failed' ||
        data.enrichment_status === 'pending'
          ? data.enrichment_status
          : 'completed';

      onContactUpdate({
        ...contact,
        enrichment_status: nextStatus,
        enrichment_data: data.enrichment_data ?? data.enrichmentdata ?? enrichment,
      });
    } catch (err: any) {
      console.error('Enrichment error:', err);
      setError(err?.message || 'Enrichment failed');
    } finally {
      setIsEnriching(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="relative bg-gray-900 rounded-lg shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">
            {contact.first_name} {contact.last_name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm">Email</label>
              <p className="text-white break-words">{contact.email || '-'}</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm">Phone</label>
              <p className="text-white">{contact.phone || '-'}</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm">Company</label>
              <p className="text-white">{contact.company || '-'}</p>
            </div>
            <div>
              <label className="text-gray-400 text-sm">Title</label>
              <p className="text-white">{contact.title || contact.job_title || '-'}</p>
            </div>
          </div>

          {/* Scores */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Scores</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">MDCP</p>
                <p className="text-2xl font-bold text-white">{contact.mdcp_score ?? '-'}</p>
                {contact.mdcp_tier && (
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getTierColor(contact.mdcp_tier)}`}>
                    {contact.mdcp_tier.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">BANT</p>
                <p className="text-2xl font-bold text-white">{contact.bant_score ?? '-'}</p>
                {contact.bant_tier && (
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getTierColor(contact.bant_tier)}`}>
                    {contact.bant_tier.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm mb-1">SPICE</p>
                <p className="text-2xl font-bold text-white">{contact.spice_score ?? '-'}</p>
                {contact.spice_tier && (
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getTierColor(contact.spice_tier)}`}>
                    {contact.spice_tier.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Enrichment */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Enrichment</h3>

            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(contact.enrichment_status)}`}>
                {contact.enrichment_status || 'pending'}
              </span>
            </div>

            {/* Render safely even if fields missing */}
            {contact.enrichment_status === 'completed' && (
              <div className="mt-4 bg-gray-800 rounded-lg p-4 space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2">Summary</h4>
                  <p className="text-gray-300 text-sm">
                    {enrichment.summary ? asString(enrichment.summary) : 'No summary available.'}
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">Talking Points</h4>
                  {talkingPoints.length === 0 ? (
                    <p className="text-gray-400 text-sm">No talking points found.</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {talkingPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">Hooks</h4>
                  {hooks.length === 0 ? (
                    <p className="text-gray-400 text-sm">No hooks found.</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {hooks.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">Objections</h4>
                  {objections.length === 0 ? (
                    <p className="text-gray-400 text-sm">No objections found.</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {objections.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">Next Steps</h4>
                  {nextSteps.length === 0 ? (
                    <p className="text-gray-400 text-sm">No next steps found.</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {nextSteps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Optional: BANT block */}
                <div>
                  <h4 className="text-white font-medium mb-2">BANT Notes</h4>
                  {bantSignals.length === 0 ? (
                    <p className="text-gray-400 text-sm">No BANT details found.</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {bantSignals.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Optional: SPICE block */}
                <div>
                  <h4 className="text-white font-medium mb-2">SPICE Notes</h4>
                  {spiceSignals.length === 0 ? (
                    <p className="text-gray-400 text-sm">No SPICE details found.</p>
                  ) : (
                    <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                      {spiceSignals.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
            Close
          </button>
          <button
            onClick={handleEnrich}
            disabled={isEnriching}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEnriching ? 'Enriching...' : 'Re-Enrich'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// ============================================================================
// CONTACTS PAGE
// ============================================================================

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isScoring, setIsScoring] = useState(false);
  const [scoringFramework, setScoringFramework] = useState('mdcp');
  const [scoringMessage, setScoringMessage] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/v3/contacts`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error(`Failed to fetch contacts: ${response.status}`);

      const data = await response.json();
      setContacts(data.contacts || data || []);
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      setError(err?.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleScoreAll = async () => {
    setIsScoring(true);
    setScoringMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setScoringMessage('Not authenticated');
        return;
      }

      const response = await fetch(`${API_URL}/api/v3/scoring/score-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ framework: scoringFramework }),
      });

      if (!response.ok) throw new Error(`Scoring failed: ${response.status}`);

      const result = await response.json();
      setScoringMessage(`✅ ${result.message}`);
      await fetchContacts();
    } catch (err: any) {
      console.error('Scoring error:', err);
      setScoringMessage(`❌ Error: ${err?.message || 'Unknown scoring error'}`);
    } finally {
      setIsScoring(false);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`${API_URL}/api/v3/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) setContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const openModal = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedContact(null);
    setIsModalOpen(false);
  };

  const handleContactUpdate = (updated: Contact) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedContact(updated);
  };

  const filteredContacts = contacts.filter((contact) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      contact.first_name?.toLowerCase().includes(search) ||
      contact.last_name?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search) ||
      contact.company?.toLowerCase().includes(search) ||
      contact.title?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Contacts</h1>
        <p className="text-gray-400">Manage and score your contacts</p>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 mb-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />

          <div className="flex items-center gap-3">
            <select
              value={scoringFramework}
              onChange={(e) => setScoringFramework(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="mdcp">MDCP</option>
              <option value="bant">BANT</option>
              <option value="spice">SPICE</option>
            </select>

            <button
              onClick={handleScoreAll}
              disabled={isScoring || contacts.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isScoring ? 'Scoring...' : `🎯 Score All (${scoringFramework.toUpperCase()})`}
            </button>

            <button onClick={fetchContacts} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
              🔄 Refresh
            </button>
          </div>
        </div>

        {scoringMessage && (
          <div
            className={`p-3 rounded-lg ${
              scoringMessage.startsWith('✅') ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'
            }`}
          >
            {scoringMessage}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6 text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      )}

      {!loading && (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium">NAME</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">EMAIL</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">COMPANY</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">TITLE</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">MDCP</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">BANT</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">SPICE</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">STATUS</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">ACTIONS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-800">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      {contacts.length === 0
                        ? 'No contacts found. Import from CRM or CSV to get started.'
                        : 'No contacts match your search.'}
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      onClick={() => openModal(contact)}
                      className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-white font-medium">
                          {contact.first_name} {contact.last_name}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-300">{contact.email || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{contact.company || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{contact.title || contact.job_title || '-'}</td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-white font-bold">{contact.mdcp_score ?? '-'}</span>
                          {contact.mdcp_tier && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTierColor(contact.mdcp_tier)}`}>
                              {contact.mdcp_tier.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-white font-bold">{contact.bant_score ?? '-'}</span>
                          {contact.bant_tier && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTierColor(contact.bant_tier)}`}>
                              {contact.bant_tier.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-white font-bold">{contact.spice_score ?? '-'}</span>
                          {contact.spice_tier && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTierColor(contact.spice_tier)}`}>
                              {contact.spice_tier.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contact.enrichment_status)}`}>
                          {contact.enrichment_status || 'pending'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(contact.id);
                          }}
                          className="px-3 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
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
        </div>
      )}

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={isModalOpen}
          onClose={closeModal}
          onContactUpdate={handleContactUpdate}
        />
      )}
    </div>
  );
}
