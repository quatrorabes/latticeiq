// frontend/src/pages/Contacts.tsx

import { useEffect, useState } from "react";
import EnrichButton from "../components/EnrichButton";
import StatusBadge from "../components/StatusBadge";
import ScoreCard from "../components/ScoreCard";
import { supabase } from "../lib/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "https://latticeiq-backend.onrender.com";

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  company: string;
  title: string;
  enrichment_status: "pending" | "enriching" | "completed" | "failed";
  apex_score: number | null;
  bant_score: number | null;
  spice_score: number | null;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${API_URL}/api/v2/contacts`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts (${response.status})`);
      }

      const data = await response.json();
      const contactsArray = Array.isArray(data) ? data : data.contacts || [];
      setContacts(contactsArray);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleEnrichComplete = () => {
    // Refetch contacts to get updated enrichment status
    fetchContacts();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <div className="spinner spinner-lg mb-4 mx-auto" />
          <p className="text-text-secondary">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Sales Contacts
          </h1>
          <p className="text-text-secondary">
            Manage and enrich your sales contacts
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-error bg-opacity-10 border border-error border-opacity-30 rounded-base text-error">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-error hover:text-error-dark text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Contacts table */}
        {contacts.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-text-secondary text-lg mb-4">
              No contacts found
            </p>
            <button
              onClick={fetchContacts}
              className="btn btn-primary"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>APEX Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td className="font-semibold text-text-primary">
                        {contact.firstname} {contact.lastname}
                      </td>
                      <td className="text-text-secondary text-sm">
                        {contact.email}
                      </td>
                      <td className="text-text-secondary">
                        {contact.company || "—"}
                      </td>
                      <td className="text-text-secondary text-sm">
                        {contact.title || "—"}
                      </td>
                      <td>
                        <StatusBadge
                          status={contact.enrichment_status}
                          size="sm"
                          animated={contact.enrichment_status === 'enriching'}
                        />
                      </td>
                      <td>
                        {contact.apex_score ? (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-success bg-opacity-20 text-success font-bold text-sm">
                            {Math.round(contact.apex_score)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {contact.enrichment_status === 'pending' || contact.enrichment_status === 'failed' ? (
                          <EnrichButton
                            contactId={contact.id}
                            onComplete={handleEnrichComplete}
                            size="sm"
                            showLabel={true}
                            variant="table"
                          />
                        ) : (
                          <span className="text-text-muted text-xs">Enriched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Score Cards Grid (Example display) */}
        {contacts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-text-primary mb-6">
              Score Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {contacts
                .filter((c) => c.apex_score)
                .slice(0, 3)
                .map((contact) => (
                  <ScoreCard
                    key={contact.id}
                    title={`${contact.firstname} ${contact.lastname}`}
                    score={contact.apex_score || 0}
                    maxScore={100}
                    subtitle={contact.company}
                    icon="📊"
                    variant="apex"
                  />
                ))}
            </div>
          </div>
        )}

        {/* Refresh button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={fetchContacts}
            className="btn btn-secondary"
          >
            Refresh Contacts
          </button>
        </div>
      </div>
    </div>
  );
}
