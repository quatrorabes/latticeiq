import React, { useState, useEffect } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "../../lib/supabase";

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
  const session = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchContacts();
    }
  }, [session]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get JWT token from Supabase session
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data?.session?.access_token) {
        setError("Not authenticated");
        return;
      }

      const token = data.session.access_token;

      // Fetch from backend with Authorization header
      const response = await fetch(
        "https://latticeiq-backend.onrender.com/api/v3/contacts", // Use production URL
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError("Unauthorized - please log in again");
        } else if (response.status === 404) {
          setError("Contacts endpoint not found");
        } else {
          setError(`Error: ${response.status} ${response.statusText}`);
        }
        return;
      }

      const data_response = await response.json();

      // Handle both array and object responses
      if (Array.isArray(data_response)) {
        setContacts(data_response);
      } else if (data_response.contacts && Array.isArray(data_response.contacts)) {
        setContacts(data_response.contacts);
      } else {
        console.warn("Unexpected API response format:", data_response);
        setContacts([]);
      }
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contacts ({contacts.length})</h1>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No contacts yet</p>
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
                  <td className="border border-gray-300 p-3">
                    {contact.company || "-"}
                  </td>
                  <td className="border border-gray-300 p-3">
                    {contact.jobtitle || "-"}
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
