import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, Upload, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import { fetchContacts, deleteContacts, Contact } from '../api/contacts';
import { enrichContact } from '../api/enrichment';
import { ContactsTable } from '../components/ContactsTable';
import '../styles/ContactsPage.css';

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchContacts(1000, 0);
      setContacts(response.contacts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const tier = contact.mdcp_tier || contact.overall_tier;
    const matchesTier = filterTier === 'all' || tier === filterTier;
    
    return matchesSearch && matchesTier;
  });

  const toggleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedContacts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const enrichSelected = async () => {
    if (selectedContacts.size === 0) return;
    setEnriching(true);
    try {
      await Promise.all(
        Array.from(selectedContacts).map(contactId => enrichContact(contactId))
      );
      alert(`✅ Enriched ${selectedContacts.size} contacts with scores!`);
      setSelectedContacts(new Set());
      loadContacts();
    } catch (err: any) {
      alert(`❌ Failed: ${err.message}`);
    } finally {
      setEnriching(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedContacts.size === 0) return;
    if (!confirm(`Delete ${selectedContacts.size} contact(s)?`)) return;
    try {
      await deleteContacts(Array.from(selectedContacts));
      setSelectedContacts(new Set());
      loadContacts();
    } catch (err: any) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await deleteContacts([contactId]);
      loadContacts();
    } catch (err: any) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  const tierCounts = {
    hot: contacts.filter(c => (c.mdcp_tier || c.overall_tier) === 'hot').length,
    warm: contacts.filter(c => (c.mdcp_tier || c.overall_tier) === 'warm').length,
    cold: contacts.filter(c => (c.mdcp_tier || c.overall_tier) === 'cold').length,
  };

  if (error) {
    return (
      <div className="contacts-page">
        <div className="error-state">
          <AlertCircle size={64} color="#ef4444" />
          <h2>Failed to Load Contacts</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadContacts}>
            <RefreshCw size={20} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contacts-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-main">
          <Users size={32} />
          <div>
            <h1>Contacts</h1>
            <p>{contacts.length} contacts • {tierCounts.hot} hot • {tierCounts.warm} warm</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={loadContacts} disabled={loading}>
            <RefreshCw size={20} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => window.location.href = '/crm'}>
            <Upload size={20} />
            Import
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="contacts-toolbar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <button className={`filter-btn ${filterTier === 'all' ? 'active' : ''}`} onClick={() => setFilterTier('all')}>
            All ({contacts.length})
          </button>
          <button className={`filter-btn ${filterTier === 'hot' ? 'active' : ''}`} onClick={() => setFilterTier('hot')}>
            🔥 Hot ({tierCounts.hot})
          </button>
          <button className={`filter-btn ${filterTier === 'warm' ? 'active' : ''}`} onClick={() => setFilterTier('warm')}>
            ⭐ Warm ({tierCounts.warm})
          </button>
          <button className={`filter-btn ${filterTier === 'cold' ? 'active' : ''}`} onClick={() => setFilterTier('cold')}>
            ❄️ Cold ({tierCounts.cold})
          </button>
        </div>

        {selectedContacts.size > 0 && (
          <div className="bulk-actions">
            <span>{selectedContacts.size} selected</span>
            <button className="btn-small" onClick={enrichSelected} disabled={enriching}>
              <Sparkles size={16} />
              {enriching ? 'Enriching...' : 'Enrich + Score'}
            </button>
            <button className="btn-small btn-danger" onClick={deleteSelected}>
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state">
          <RefreshCw className="spin" size={48} />
          <p>Loading contacts...</p>
        </div>
      ) : (
        <ContactsTable
          contacts={filteredContacts}
          onEnrichContact={(contactId) => enrichContact(contactId).then(() => loadContacts())}
          onDeleteContact={handleDeleteContact}
          enrichingIds={new Set()}
        />
      )}
    </div>
  );
};

export default ContactsPage;
