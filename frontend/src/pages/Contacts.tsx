import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Contact } from "../types/contact";
import ContactDetailModal from "../components/ContactDetailModal";
import EnrichButton from "../components/EnrichButton";

const API_URL = import.meta.env.VITE_API_URL || "https://latticeiq-backend.onrender.com";

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(`${API_URL}/api/contacts`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error("Failed to load contacts");

      const data = await response.json();
      setContacts(data.contacts || []);
      setFilteredContacts(data.contacts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredContacts(
      contacts.filter(
        (c) =>
          c.first_name?.toLowerCase().includes(q) ||
          c.last_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, contacts]);

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this contact?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`${API_URL}/api/contacts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      loadContacts();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const stats = {
    total: contacts.length,
    pending: contacts.filter((c) => c.enrichment_status === "pending").length,
    enriched: contacts.filter((c) => c.enrichment_status === "completed").length,
    failed: contacts.filter((c) => c.enrichment_status === "failed").length,
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-900/50 text-yellow-300",
      processing: "bg-blue-900/50 text-blue-300",
      completed: "bg-green-900/50 text-green-300",
      failed: "bg-red-900/50 text-red-300",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
        {status}
      </span>
    );
  };

  const getScoreBadge = (score: number | null | undefined) => {
    if (!score) return <span className="text-gray-500">—</span>;
    let color = "text-gray-400";
    if (score >= 75) color = "text-green-400 font-bold";
    else if (score >= 50) color = "text-yellow-400";
    else color = "text-red-400";
    return <span className={color}>{score}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Contacts</h1>
        <p className="text-gray-400">Manage and enrich your sales contacts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-white">{stats.total}</div>
          <div className="text-gray-400 text-sm">Total</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
          <div className="text-gray-400 text-sm">Pending</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-green-400">{stats.enriched}</div>
          <div className="text-gray-400 text-sm">Enriched</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
          <div className="text-gray-400 text-sm">Failed</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Score</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No contacts found
                </td>
              </tr>
            ) : (
              filteredContacts.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => handleRowClick(contact)}
                  className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">
                      {contact.first_name} {contact.last_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{contact.email}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{contact.company || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{contact.title || "—"}</td>
                  <td className="px-4 py-3">{getStatusBadge(contact.enrichment_status)}</td>
                  <td className="px-4 py-3">{getScoreBadge(contact.apex_score)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {(contact.enrichment_status === "pending" || contact.enrichment_status === "failed") && (
                        <EnrichButton
                          contactId={contact.id}
                          onComplete={loadContacts}
                          variant="table"
                        />
                      )}
                      {contact.enrichment_status === "completed" && (
                        <button
                          onClick={() => handleRowClick(contact)}
                          className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                        >
                          View
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(contact.id, e)}
                        className="px-2 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredContacts.length} of {contacts.length} contacts
      </div>

      {/* Modal */}
      <ContactDetailModal
        contact={selectedContact}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEnrichComplete={loadContacts}
      />
    </div>
  );
}
