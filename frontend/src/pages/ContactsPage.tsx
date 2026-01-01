import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, Upload, Trash2, Edit2, Sparkles, AlertCircle } from 'lucide-react';
import { fetchContacts, deleteContacts, Contact } from '../api/contacts';
import { enrichContacts } from '../api/enrichment';
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
      console.error('Failed to load contacts:', err);
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
    
    const matchesTier = filterTier === 'all' || contact.mdcp_tier === filterTier;
    
    return matchesSearch && matchesTier;
  });

  const toggleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
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
      const contactIds = Array.from(selectedContacts);
      await enrichContacts(contactIds);
      alert(`Started enriching ${contactIds.length} contacts. This may take a few minutes.`);
      
      // Reload contacts after a delay
      setTimeout(() => {
        loadContacts();
      }, 3000);
      
      setSelectedContacts(new Set());
    } catch (err: any) {
      alert(`Failed to enrich contacts: ${err.message}`);
    } finally {
      setEnriching(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedContacts.size === 0) return;
    
    if (!confirm(`Delete ${selectedContacts.size} contact(s)? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteContacts(Array.from(selectedContacts));
      alert('Contacts deleted successfully');
      setSelectedContacts(new Set());
      loadContacts();
    } catch (err: any) {
      alert(`Failed to delete contacts: ${err.message}`);
    }
  };

  const getScoreColor = (tier?: string) => {
    if (!tier) return '#6b7280';
    switch (tier.toLowerCase()) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (error) {
    return (
      <div className="contacts-page">
        <div className="error-state">
          <AlertCircle size={64} color="#ef4444" />
          <h2>Failed to Load Contacts</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadContacts}>
            <RefreshCw size={20} />
            Retry
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
            <p>Manage and enrich your contact database ({contacts.length} total)</p>
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
          <button
            className={`filter-btn ${filterTier === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTier('all')}
          >
            All ({contacts.length})
          </button>
          <button
            className={`filter-btn ${filterTier === 'hot' ? 'active' : ''}`}
            onClick={() => setFilterTier('hot')}
          >
            🔥 Hot ({contacts.filter(c => c.mdcp_tier === 'hot').length})
          </button>
          <button
            className={`filter-btn ${filterTier === 'warm' ? 'active' : ''}`}
            onClick={() => setFilterTier('warm')}
          >
            ⭐ Warm ({contacts.filter(c => c.mdcp_tier === 'warm').length})
          </button>
          <button
            className={`filter-btn ${filterTier === 'cold' ? 'active' : ''}`}
            onClick={() => setFilterTier('cold')}
          >
            ❄️ Cold ({contacts.filter(c => c.mdcp_tier === 'cold').length})
          </button>
        </div>

        {selectedContacts.size > 0 && (
          <div className="bulk-actions">
            <span>{selectedContacts.size} selected</span>
            <button className="btn-small" onClick={enrichSelected} disabled={enriching}>
              <Sparkles size={16} />
              {enriching ? 'Enriching...' : 'Enrich'}
            </button>
            <button className="btn-small btn-danger" onClick={deleteSelected}>
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Contacts Table */}
      {loading ? (
        <div className="loading-state">
          <RefreshCw className="spin" size={48} />
          <p>Loading contacts...</p>
        </div>
      ) : (
        <div className="contacts-table-container">
          <table className="contacts-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Contact</th>
                <th>Company</th>
                <th>Title</th>
                <th>Email</th>
                <th>MDCP</th>
                <th>BANT</th>
                <th>SPICE</th>
                <th>Overall</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => (
                <tr key={contact.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => toggleSelectContact(contact.id)}
                    />
                  </td>
                  <td>
                    <div className="contact-cell">
                      <div className="contact-avatar">
                        {contact.first_name?.[0]}{contact.last_name?.[0]}
                      </div>
                      <div>
                        <div className="contact-name">
                          {contact.first_name} {contact.last_name}
                        </div>
                        <div className="contact-phone">{contact.phone || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td>{contact.company || '—'}</td>
                  <td>{contact.title || '—'}</td>
                  <td className="email-cell">{contact.email}</td>
                  <td>
                    {contact.mdcp_score ? (
                      <span
                        className="score-badge"
                        style={{ backgroundColor: getScoreColor(contact.mdcp_tier) }}
                      >
                        {contact.mdcp_score}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {contact.bant_score ? (
                      <span className="score-badge-small">{contact.bant_score}</span>
                    ) : '—'}
                  </td>
                  <td>
                    {contact.spice_score ? (
                      <span className="score-badge-small">{contact.spice_score}</span>
                    ) : '—'}
                  </td>
                  <td>
                    {contact.overall_score ? (
                      <span className="score-badge-overall">{contact.overall_score}</span>
                    ) : '—'}
                  </td>
                  <td>
                    <span className={`status-badge status-${contact.enrichment_status}`}>
                      {contact.enrichment_status === 'completed' ? '✓ Enriched' : '⏳ Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button 
                        className="btn-icon" 
                        title="Enrich"
                        onClick={() => {
                          setSelectedContacts(new Set([contact.id]));
                          enrichSelected();
                        }}
                      >
                        <Sparkles size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredContacts.length === 0 && !loading && (
            <div className="empty-state">
              <Users size={64} />
              <h3>No contacts found</h3>
              <p>Try adjusting your search or filters, or import contacts from the CRM Import page</p>
              <button className="btn-primary" onClick={() => window.location.href = '/crm'}>
                <Upload size={20} />
                Import Contacts
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContactsPage;
