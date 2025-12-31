// ============================================================================
// FILE: frontend/src/pages/ContactsPage.tsx
// Contacts page with Score All button
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Calculator, RefreshCw } from 'lucide-react';
import { ContactsTable } from '../components/ContactsTable';
import { ContactDetailModal } from '../components/ContactDetailModal';
import { Contact } from '../types';
import { supabase } from '../lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProgress, setScoringProgress] = useState('');

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE}/api/v3/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(data.contacts || data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleEnrichContact = async (contactId: string) => {
    setEnrichingIds((prev) => new Set(prev).add(contactId));
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE}/api/v3/enrichment/quick-enrich/${contactId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Enrichment failed');
      await fetchContacts();
    } catch (error) {
      console.error('Error enriching contact:', error);
    } finally {
      setEnrichingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  const handleScoreAllContacts = async () => {
    setIsScoring(true);
    setScoringProgress('Starting...');
    
    try {
      const token = await getAuthToken();
      let scored = 0;
      const total = contacts.length;

      for (const contact of contacts) {
        setScoringProgress(`Scoring ${scored + 1} of ${total}...`);
        
        try {
          const response = await fetch(`${API_BASE}/api/v3/scoring/calculate-all/${contact.id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contact_data: contact }),
          });
          
          if (response.ok) {
            scored++;
          }
        } catch (err) {
          console.error(`Failed to score contact ${contact.id}:`, err);
        }
      }

      setScoringProgress(`Completed! Scored ${scored} contacts.`);
      await fetchContacts();
      
      setTimeout(() => {
        setScoringProgress('');
      }, 3000);
    } catch (error) {
      console.error('Error scoring contacts:', error);
      setScoringProgress('Scoring failed');
    } finally {
      setIsScoring(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE}/api/v3/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete contact');
      await fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.first_name?.toLowerCase().includes(query) ||
      contact.last_name?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Contacts</h1>
          <p className="text-slate-400 mt-1">Manage and enrich your sales contacts</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Score All Button */}
          <button
            onClick={handleScoreAllContacts}
            disabled={isScoring || contacts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calculator className={`w-4 h-4 ${isScoring ? 'animate-spin' : ''}`} />
            {isScoring ? scoringProgress : 'Score All'}
          </button>
          
          {/* Refresh Button */}
          <button
            onClick={fetchContacts}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Add Contact Button */}
          <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        ) : (
          <ContactsTable
            contacts={filteredContacts}
            onSelectContact={handleSelectContact}
            onEnrichContact={handleEnrichContact}
            onDeleteContact={handleDeleteContact}
            enrichingIds={enrichingIds}
          />
        )}
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedContact(null);
          }}
          onEnrich={() => handleEnrichContact(selectedContact.id)}
          isEnriching={enrichingIds.has(selectedContact.id)}
        />
      )}
    </div>
  );
}

export default ContactsPage;
