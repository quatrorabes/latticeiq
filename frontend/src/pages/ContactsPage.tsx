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

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get token from localStorage (set by App.tsx auth handler)
      const token = localStorage.getItem("sb-auth-token");

      if (!token) {
        setError("Not authenticated - please log in");
        return;
      }

      // Fetch from backend with JWT token
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
      <h1 className="text-3xl font-bold">Contacts ({contacts.length})</h1>

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
                <th className="border border-gray-300 p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    {contact.firstname} {contact.lastname}
                  </td>
                  <td className="border border-gray-300 p-3">{contact.email}</td>
                  <td className="border border-gray-300 p-3">{contact.company || "-"}</td>
                  <td className="border border-gray-300 p-3">{contact.jobtitle || "-"}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ContactsPage;
