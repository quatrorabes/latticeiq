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
      if (result.data.session) {
        setIsAuthenticated(true);
      } else {
        setIsLoading(false);
      }
    });
    var authSub = supabase.auth.onAuthStateChange(function(event, sess) {
      if (sess) { setIsAuthenticated(true); } 
      else { setIsAuthenticated(false); setIsLoading(false); }
    });
    return function() { authSub.data.subscription.unsubscribe(); };
  }, []);

  useEffect(function() { if (isAuthenticated) { fetchContacts(); } }, [isAuthenticated]);
  useEffect(function() { filterContacts(); }, [contacts, searchTerm]);

  function fetchContacts() {
    setIsLoading(true);
    setError(null);
    supabase.auth.getSession().then(function(result) {
      var sess = result.data.session;
      if (!sess) { setError('Please log in'); setIsLoading(false); return; }
      var url = import.meta.env.VITE_API_URL + '/api/v3/contacts';
      fetch(url, { headers: { 'Authorization': 'Bearer ' + sess.access_token } })
        .then(function(res) { return res.json(); })
        .then(function(data) { setContacts(data.contacts || data || []); setIsLoading(false); })
        .catch(function(err) { setError(err.message); setIsLoading(false); });
    });
  }
  // ... rest truncated for terminal

