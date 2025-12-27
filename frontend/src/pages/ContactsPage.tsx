import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Contact } from '../types/contact';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then((result) => {
      if (result.data.session) {
        setIsAuthenticated(true);
      } else {
        setIsLoading(false);
      }
    });
    const sub = supabase.auth.onAuthStateChange((_event, sess) => {
      setIsAuthenticated(!!sess);
      if (!sess) setIsLoading(false);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchContacts();
  }, [isAuthenticated]);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm]);

  async function fetchContacts() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await supabase.auth.getSession();
      const sess = result.data.session;
      if (!sess) {
        setError('Not logged in');
        setIsLoading(false);
        return;
      }
      const res = await fetch(import.meta.env.VITE_API_URL + '/api/v3/contacts', {
        headers: { 'Authorization': 'Bearer ' + sess.access_token }
      });
      const data = await res.json();
      setContacts(data.contacts || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsLoading(false);
    }
  }

  function filterContacts() {
    const term = searchTerm.toLowerCase();
    setFilteredContacts(contacts.filter((c: Contact) => 
      (c.first_name || '').toLowerCase().includes(term) ||
      (c.last_name || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.company || '').toLowerCase().includes(term)
    ));
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete?')) return;
    try {
      const result = await supabase.auth.getSession();
      const sess = result.data.session;
      if (!sess) return;
      await fetch(import.meta.env.VITE_API_URL + '/api/v3/contacts/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + sess.access_token }
      });
      setContacts(contacts.filter((c: Contact) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="p-8 bg-slate-900 min-h-screen">
      <h1 className="text-3xl font-bold text-white mb-6">Contacts</h1>

      <input type="text" placeholder="Search..." value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-slate-800 text-white rounded px-4 py-2 border border-slate-700 mb-6" />

      {error && <div className="bg-red-900 text-red-100 p-4 rounded mb-6">{error}</div>}

      {isLoading ? (
        <p className="text-slate-400">Loading...</p>
      ) : filteredContacts.length === 0 ? (
        <p className="text-slate-400">No contacts</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800">
              <th className="text-left p-3 text-white">Name</th>
              <th className="text-left p-3 text-white">Email</th>
              <th className="text-left p-3 text-white">Company</th>
              <th className="text-left p-3 text-white">Score</th>
              <th className="text-left p-3 text-white">Status</th>
              <th className="text-left p-3 text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((c: Contact) => (
              <tr key={c.id} className="border-b border-slate-700 hover:bg-slate-800">
                <td className="p-3 text-white">{c.first_name} {c.last_name}</td>
                <td className="p-3 text-slate-400">{c.email}</td>
                <td className="p-3 text-slate-400">{c.company || '-'}</td>
                <td className="p-3 text-white font-bold">{c.apex_score?.toFixed(0) || '-'}</td>
                <td className="p-3 text-slate-400">{c.enrichment_status || 'pending'}</td>
                <td className="p-3">
                  <button onClick={() => { setSelectedContact(c); setShowModal(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm mr-2">
                    View
                  </button>
                  <button onClick={() => deleteContact(c.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && selectedContact && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#1e293b', color: '#f1f5f9', padding: '30px', borderRadius: '8px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto', border: '1px solid #475569' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>{selectedContact.first_name} {selectedContact.last_name}</h2>
              <button onClick={() => setShowModal(false)} style={{ fontSize: '24px', background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <p style={{ color: '#cbd5e1', fontSize: '12px' }}>Email</p>
              <p style={{ color: '#f1f5f9' }}>{selectedContact.email}</p>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <p style={{ color: '#cbd5e1', fontSize: '12px' }}>Company</p>
              <p style={{ color: '#f1f5f9' }}>{selectedContact.company || 'N/A'}</p>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <p style={{ color: '#cbd5e1', fontSize: '12px' }}>Job Title</p>
              <p style={{ color: '#f1f5f9' }}>{selectedContact.job_title || 'N/A'}</p>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <p style={{ color: '#cbd5e1', fontSize: '12px' }}>APEX Score</p>
              <p style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 'bold' }}>{selectedContact.apex_score?.toFixed(1) || 'N/A'}</p>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <p style={{ color: '#cbd5e1', fontSize: '12px' }}>Status</p>
              <p style={{ color: '#f1f5f9' }}>{selectedContact.enrichment_status || 'pending'}</p>
            </div>

            {selectedContact.enrichment_status === 'completed' && selectedContact.enrichment_data && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#0f172a', borderRadius: '4px' }}>
                <p style={{ color: '#cbd5e1', fontSize: '12px', marginBottom: '10px' }}>Enrichment Data</p>
                <pre style={{ fontSize: '11px', color: '#cbd5e1', overflow: 'auto', maxHeight: '200px' }}>
                  {JSON.stringify(selectedContact.enrichment_data, null, 2)}
                </pre>
              </div>
            )}

            <button onClick={() => setShowModal(false)}
              style={{ marginTop: '20px', width: '100%', backgroundColor: '#3b82f6', color: '#f1f5f9', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
