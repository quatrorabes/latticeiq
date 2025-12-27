import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ContactDetailModalPremium } from '../components/ContactDetailModalPremium';
import type { Contact } from '../types/contact';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(function authListener() {
    supabase.auth.getSession().then(function(result) {
      if (result.data.session) setIsAuthenticated(true);
      else setIsLoading(false);
    });
    var sub = supabase.auth.onAuthStateChange(function(ev, sess) {
      if (sess) setIsAuthenticated(true);
      else { setIsAuthenticated(false); setIsLoading(false); }
    });
    return function() { sub.data.subscription.unsubscribe(); };
  }, []);

  useEffect(function() { if (isAuthenticated) fetchContacts(); }, [isAuthenticated]);
  useEffect(function() { filterContacts(); }, [contacts, searchTerm]);

  function fetchContacts() {
    setIsLoading(true);
    setError(null);
    supabase.auth.getSession().then(function(r) {
      var sess = r.data.session;
      if (!sess) { setError('Not logged in'); setIsLoading(false); return; }
      fetch(import.meta.env.VITE_API_URL + '/api/v3/contacts', {
        headers: { 'Authorization': 'Bearer ' + sess.access_token }
      }).then(function(res) { return res.json(); })
        .then(function(d) { setContacts(d.contacts || d || []); setIsLoading(false); })
        .catch(function(e) { setError(e.message); setIsLoading(false); });
    });
  }

  function filterContacts() {
    var term = searchTerm.toLowerCase();
    setFilteredContacts(contacts.filter(function(c) {
      return (c.first_name||'').toLowerCase().includes(term) ||
        (c.last_name||'').toLowerCase().includes(term) ||
        (c.email||'').toLowerCase().includes(term) ||
        (c.company||'').toLowerCase().includes(term);
    }));
  }

  function handleRowClick(contact) { setSelectedContact(contact); setIsModalOpen(true); }
  function handleCloseModal() { setIsModalOpen(false); setSelectedContact(null); }

  function handleDeleteContact(id, e) {
    e.stopPropagation();
    if (!confirm('Delete?')) return;
    supabase.auth.getSession().then(function(r) {
      var sess = r.data.session;
      if (!sess) return;
      fetch(import.meta.env.VITE_API_URL + '/api/v3/contacts/' + id, {
        method: 'DELETE', headers: { 'Authorization': 'Bearer ' + sess.access_token }
      }).then(function() { setContacts(contacts.filter(function(c) { return c.id !== id; })); });
    });
  }

  function getStatusBadge(s) {
    if (s === 'completed') return 'bg-green-100 text-green-800';
    if (s === 'processing') return 'bg-yellow-100 text-yellow-800';
    if (s === 'failed') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  }

  function getScoreColor(sc) {
    if (!sc) return 'text-gray-500';
    if (sc >= 75) return 'text-green-600';
    if (sc >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }

  if (!isAuthenticated && !isLoading) {
    return (<div className="p-6 bg-slate-900 min-h-screen flex items-center justify-center">
      <div className="text-center"><h2 className="text-2xl font-bold text-white mb-4">Please Log In</h2></div>
    </div>);
  }

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Contacts</h1>
        <p className="text-slate-400">Manage and enrich your sales contacts</p>
      </div>
      <div className="mb-6">
        <input type="text" placeholder="Search..." value={searchTerm}
          onChange={function(e) { setSearchTerm(e.target.value); }}
          className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700" />
      </div>
      {error && <div className="mb-6 bg-red-900 text-red-100 p-4 rounded-lg">{error}</div>}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center"><p className="text-slate-400">Loading...</p></div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-12 text-center"><p className="text-slate-400">No contacts</p></div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-700 bg-slate-700">
              <th className="px-6 py-4 text-left">Name</th>
              <th className="px-6 py-4 text-left">Email</th>
              <th className="px-6 py-4 text-left">Company</th>
              <th className="px-6 py-4 text-left">Title</th>
              <th className="px-6 py-4 text-left">Score</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">Actions</th>
            </tr></thead>
            <tbody>
              {filteredContacts.map(function(c) {
                return (<tr key={c.id} className="border-b border-slate-700 hover:bg-slate-700 cursor-pointer"
                  onClick={function() { handleRowClick(c); }}>
                  <td className="px-6 py-4 text-white">{c.first_name} {c.last_name}</td>
                  <td className="px-6 py-4 text-slate-400">{c.email}</td>
                  <td className="px-6 py-4 text-slate-400">{c.company || 'N/A'}</td>
                  <td className="px-6 py-4 text-slate-400">{c.job_title || 'N/A'}</td>
                  <td className={'px-6 py-4 font-bold ' + getScoreColor(c.apex_score)}>
                    {c.apex_score ? c.apex_score.toFixed(0) : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={'text-xs px-3 py-1 rounded-full ' + getStatusBadge(c.enrichment_status)}>
                      {c.enrichment_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={function(e) { handleDeleteContact(c.id, e); }}
                      className="text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>);
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Total</p>
          <p className="text-3xl font-bold text-white mt-2">{contacts.length}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Enriched</p>
          <p className="text-3xl font-bold text-green-500 mt-2">
            {contacts.filter(function(c) { return c.enrichment_status === 'completed'; }).length}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Avg Score</p>
          <p className="text-3xl font-bold text-blue-500 mt-2">
            {contacts.length > 0 ? (contacts.reduce(function(s,c) { return s + (c.apex_score||0); }, 0) / contacts.length).toFixed(0) : 'N/A'}
          </p>
        </div>
      </div>
      {isModalOpen && selectedContact && (
        <ContactDetailModalPremium contact={selectedContact} isOpen={isModalOpen}
          onClose={handleCloseModal} onEnrichComplete={fetchContacts}
          onContactUpdate={function(c) { setContacts(contacts.map(function(x) { return x.id === c.id ? c : x; })); }} />
      )}
    </div>
  );
}