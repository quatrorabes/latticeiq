import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  job_title?: string;
  linkedin_url?: string;
  enrichment_status?: string;
  mdcp_score?: number;
  bant_score?: number;
  spice_score?: number;
  created_at?: string;
  updated_at?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  const getAuthToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Not logged in (missing access token).");
    return token;
  };

  const fetchContacts = async () => {
    if (!apiUrl) {
      setError("Missing VITE_API_URL in frontend environment.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      const res = await fetch(`${apiUrl}/api/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to fetch contacts (${res.status}): ${txt}`);
      }

      const data = await res.json();
      setContacts(Array.isArray(data) ? data : data.contacts || []);
    } catch (err: any) {
      setError(err?.message || String(err));
      console.error("Error fetching contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter contacts based on search term and status
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = !filterStatus || c.enrichment_status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score && score !== 0) return "text-gray-500";
    if (score >= 75) return "text-green-600 font-bold";
    if (score >= 50) return "text-yellow-600 font-bold";
    return "text-red-600 font-bold";
  };

  if (loading) {
    return <div className="p-6 text-center">Loading contacts...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Contacts</h1>

      <div className="bg-blue-50 p-4 mb-6 rounded border border-blue-200">
        <p className="text-sm text-blue-900">
          📧 Import from CSV, HubSpot, Salesforce, or Pipedrive, then score with MDCP/BANT/SPICE.
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Import from your CRM or upload a CSV to get started.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 p-4 mb-6 rounded text-red-700">
          {error}
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="mb-6 space-y-4">
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus(null)}
            className={`px-4 py-2 rounded text-sm ${
              filterStatus === null
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            All Statuses
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            className={`px-4 py-2 rounded text-sm ${
              filterStatus === "pending"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus("processing")}
            className={`px-4 py-2 rounded text-sm ${
              filterStatus === "processing"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Processing
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`px-4 py-2 rounded text-sm ${
              filterStatus === "completed"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Enriched
          </button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Company</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Title</th>
              <th className="px-6 py-3 text-center text-sm font-semibold">MDCP</th>
              <th className="px-6 py-3 text-center text-sm font-semibold">BANT</th>
              <th className="px-6 py-3 text-center text-sm font-semibold">SPICE</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No contacts found
                </td>
              </tr>
            ) : (
              filteredContacts.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm">{`${c.first_name} ${c.last_name}`}</td>
                  <td className="px-6 py-3 text-sm">{c.email || "-"}</td>
                  <td className="px-6 py-3 text-sm">{c.company || "-"}</td>
                  <td className="px-6 py-3 text-sm">{c.job_title || "-"}</td>
                  <td className={`px-6 py-3 text-sm text-center ${getScoreColor(c.mdcp_score)}`}>
                    {c.mdcp_score !== undefined ? Math.round(c.mdcp_score) : "-"}
                  </td>
                  <td className={`px-6 py-3 text-sm text-center ${getScoreColor(c.bant_score)}`}>
                    {c.bant_score !== undefined ? Math.round(c.bant_score) : "-"}
                  </td>
                  <td className={`px-6 py-3 text-sm text-center ${getScoreColor(c.spice_score)}`}>
                    {c.spice_score !== undefined ? Math.round(c.spice_score) : "-"}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(c.enrichment_status)}`}>
                      {c.enrichment_status || "pending"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {contacts.length > 0 && (
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-sm text-blue-600">Total Contacts</p>
            <p className="text-2xl font-bold text-blue-900">{contacts.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <p className="text-sm text-green-600">Enriched</p>
            <p className="text-2xl font-bold text-green-900">
              {contacts.filter((c) => c.enrichment_status === "completed").length}
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded">
            <p className="text-sm text-yellow-600">Processing</p>
            <p className="text-2xl font-bold text-yellow-900">
              {contacts.filter((c) => c.enrichment_status === "processing").length}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-gray-900">
              {contacts.filter((c) => c.enrichment_status === "pending").length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
