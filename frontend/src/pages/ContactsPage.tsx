import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { Users, RefreshCw, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  title?: string;
  enrichment_status?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_BASE}/api/v3/contacts`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const data = await response.json();
      setContacts(Array.isArray(data) ? data : data.contacts || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const selected = contacts.find(c => c.id === selectedId);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      <div className="max-w-7xl">
        <h1 className="text-3xl font-bold mb-4">Contacts ({contacts.length})</h1>
        
        <button
          onClick={fetchContacts}
          disabled={loading}
          className="mb-4 px-4 py-2 bg-cyan-600 rounded hover:bg-cyan-700"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>

        <table className="w-full border-collapse bg-gray-800">
          <thead>
            <tr className="bg-gray-900">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr
                key={c.id}
                onClick={() => {
                  console.log('✅ CLICKED:', c.email);
                  setSelectedId(c.id);
                }}
                className="border-t border-gray-700 hover:bg-gray-700 cursor-pointer"
              >
                <td className="p-3">{c.first_name} {c.last_name}</td>
                <td className="p-3">{c.email || '-'}</td>
                <td className="p-3">{c.company || '-'}</td>
                <td className="p-3">{c.enrichment_status || 'pending'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ✅ PORTAL - Renders outside <main> container! */}
      {selected && createPortal(
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="bg-gray-900 rounded-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selected.first_name} {selected.last_name}</h2>
                <p className="text-gray-400">{selected.email}</p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-gray-500 text-sm">Company</span>
                <p>{selected.company || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Title</span>
                <p>{selected.title || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Status</span>
                <p>{selected.enrichment_status || 'pending'}</p>
              </div>
            </div>

            <button
              onClick={() => alert('Enrich ' + selected.email)}
              className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded font-medium"
            >
              Re-Enrich
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
