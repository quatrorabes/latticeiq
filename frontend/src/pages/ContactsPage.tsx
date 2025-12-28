import React, { useState, useEffect } from "react";

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  company?: string;
  jobtitle?: string;
  enrichmentstatus: string;
}

interface EnrichmentResult {
  phone?: string;
  company?: string;
  jobtitle?: string;
  linkedin_url?: string;
}

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("sb-auth-token");
      if (!token) {
        setError("Not authenticated - please log in");
        return;
      }

      const response = await fetch(
        "https://latticeiq-backend.onrender.com/api/v3/contacts",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError("Unauthorized - token expired, please log in again");
        } else {
          setError(`API error: ${response.status}`);
        }
        return;
      }

      const data = await response.json();
      setContacts(Array.isArray(data) ? data : data.contacts || []);
    } catch (err) {
      console.error("Error fetching contacts:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleEnrich = async (contact: Contact) => {
    setSelectedContact(contact);
    setEnriching(true);
    setEnrichmentResult(null);

    try {
      const token = localStorage.getItem("sb-auth-token");
      if (!token) {
        setError("Not authenticated");
        setEnriching(false);
        return;
      }

      const response = await fetch(
        `https://latticeiq-backend.onrender.com/api/v3/enrichment?email=${encodeURIComponent(
          contact.email
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Enrichment failed: ${response.status}`);
      }

      const data = await response.json();
      setEnrichmentResult(data);

      // Update contact in list
      const updatedContacts = contacts.map((c) =>
        c.id === contact.id
          ? {
              ...c,
              phone: data.phone || c.phone,
              company: data.company || c.company,
              jobtitle: data.jobtitle || c.jobtitle,
              enrichmentstatus: "completed",
            }
          : c
      );
      setContacts(updatedContacts);
    } catch (err) {
      console.error("Error enriching contact:", err);
      setError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading contacts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-semibold">Error</p>
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchContacts}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contacts ({contacts.length})</h1>
        <button
          onClick={fetchContacts}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No contacts yet. Import some to get started!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 p-3 text-left">Name</th>
                <th className="border border-gray-300 p-3 text-left">Email</th>
                <th className="border border-gray-300 p-3 text-left">Company</th>
                <th className="border border-gray-300 p-3 text-left">Title</th>
                <th className="border border-gray-300 p-3 text-left">Phone</th>
                <th className="border border-gray-300 p-3 text-left">Status</th>
                <th className="border border-gray-300 p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    {contact.firstname} {contact.lastname}
                  </td>
                  <td className="border border-gray-300 p-3 text-sm">{contact.email}</td>
                  <td className="border border-gray-300 p-3">
                    {contact.company || "-"}
                  </td>
                  <td className="border border-gray-300 p-3">
                    {contact.jobtitle || "-"}
                  </td>
                  <td className="border border-gray-300 p-3">
                    {contact.phone || "-"}
                  </td>
                  <td className="border border-gray-300 p-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                        contact.enrichmentstatus === "completed"
                          ? "bg-green-100 text-green-800"
                          : contact.enrichmentstatus === "processing"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {contact.enrichmentstatus}
                    </span>
                  </td>
                  <td className="border border-gray-300 p-3 text-center">
                    <button
                      onClick={() => handleEnrich(contact)}
                      disabled={enriching && selectedContact?.id === contact.id}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {enriching && selectedContact?.id === contact.id
                        ? "Enriching..."
                        : "Enrich"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Enrichment Result Modal */}
      {selectedContact && enrichmentResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              Enrichment Results: {selectedContact.firstname}{" "}
              {selectedContact.lastname}
            </h2>

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{selectedContact.email}</p>
              </div>

              {enrichmentResult.company && (
                <div>
                  <p className="text-sm text-gray-600">Company</p>
                  <p className="font-medium">{enrichmentResult.company}</p>
                </div>
              )}

              {enrichmentResult.jobtitle && (
                <div>
                  <p className="text-sm text-gray-600">Job Title</p>
                  <p className="font-medium">{enrichmentResult.jobtitle}</p>
                </div>
              )}

              {enrichmentResult.phone && (
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{enrichmentResult.phone}</p>
                </div>
              )}

              {enrichmentResult.linkedin_url && (
                <div>
                  <p className="text-sm text-gray-600">LinkedIn</p>
                  <a
                    href={enrichmentResult.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Profile
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setSelectedContact(null);
                setEnrichmentResult(null);
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsPage;
