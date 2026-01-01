import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, RefreshCw, Upload, Trash2, Edit2, Sparkles } from 'lucide-react';
import '../styles/ContactsPage.css';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  title?: string;
  phone?: string;
  mdcp_score?: number;
  mdcp_tier?: string;
  bant_score?: number;
  spice_score?: number;
  overall_score?: number;
  enrichment_status?: string;
  pipeline_stage?: string;
  created_at: string;
}

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      // In production: const response = await fetch('/api/v3/contacts');
      // Mock data
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockContacts: Contact[] = [
        {
          id: '1',
          first_name: 'John',
          last_name: 'Smith',
          email: 'john@acme.com',
          company: 'Acme Inc',
          title: 'VP Sales',
          phone: '+1-555-0123',
          mdcp_score: 85,
          mdcp_tier: 'hot',
          bant_score: 78,
          spice_score: 82,
          overall_score: 82,
          enrichment_status: 'completed',
          pipeline_stage: 'meeting',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          first_name: 'Sarah',
          last_name: 'Johnson',
          email: 'sarah@techcorp.com',
          company: 'TechCorp',
          title: 'CEO',
          phone: '+1-555-0124',
          mdcp_score: 92,
          mdcp_tier: 'hot',
          bant_score: 88,
          spice_score: 90,
          overall_score: 90,
          enrichment_status: 'completed',
          pipeline_stage: 'qualified',
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          first_name: 'Mike',
          last_name: 'Chen',
          email: 'mike@startup.io',
          company: 'Startup Inc',
          title: 'Founder',
          mdcp_score: 58,
          mdcp_tier: 'warm',
          bant_score: 52,
          spice_score: 55,
          overall_score: 55,
          enrichment_status: 'completed',
          pipeline_stage: 'new',
          created_at: new Date().toISOString()
        },
        {
          id: '4',
          first_name: 'Emily',
          last_name: 'Davis',
          email: 'emily@corp.com',
          company: 'Corp LLC',
          title: 'Director',
          mdcp_score: 28,
          mdcp_tier: 'cold',
          enrichment_status: 'pending',
          pipeline_stage: 'new',
          created_at: new Date().toISOString()
        }
      ];
      
      setContacts(mockContacts);
    } catch (err) {
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

  const getScoreColor = (tier?: string) => {
    if (!tier) return '#6b7280';
    switch (tier.toLowerCase()) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const enrichSelected = async () => {
    alert(`Enriching ${selectedContacts.size} contacts...`);
    // In production: POST /api/v3/enrichment/batch
  };

  return (
    <div className="contacts-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-main">
          <Users size={32} />
          <div>
            <h1>Contacts</h1>
            <p>Manage and enrich your contact database</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={loadContacts}>
            <RefreshCw size={20} />
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
            <button className="btn-small" onClick={enrichSelected}>
              <Sparkles size={16} />
              Enrich
            </button>
            <button className="btn-small btn-danger">
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
                      <button className="btn-icon" title="Enrich">
                        <Sparkles size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredContacts.length === 0 && (
            <div className="empty-state">
              <Users size={64} />
              <h3>No contacts found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContactsPage;
