import React, { useState, useEffect } from 'react';
import { Users, Plus, Filter, Trash2, Edit2, RefreshCw } from 'lucide-react';
import '../styles/SmartListsPage.css';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  title?: string;
  mdcp_score?: number;
  mdcp_tier?: string;
  enrichment_status?: string;
  created_at: string;
}

interface SmartList {
  id: string;
  name: string;
  description?: string;
  filters: any[];
  filter_logic: 'AND' | 'OR';
  color: string;
  icon: string;
  created_at: string;
}

interface PresetList {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  filters: any[];
}

const PRESET_LISTS: PresetList[] = [
  {
    id: 'hot-leads',
    name: '🔥 Hot Leads',
    description: 'MDCP score ≥ 71',
    icon: '🔥',
    color: '#ef4444',
    filters: [{ field: 'mdcp_score', operator: 'gte', value: 71 }]
  },
  {
    id: 'warm-leads',
    name: '⭐ Warm Leads',
    description: 'MDCP score 40-70',
    icon: '⭐',
    color: '#f59e0b',
    filters: [
      { field: 'mdcp_score', operator: 'gte', value: 40 },
      { field: 'mdcp_score', operator: 'lt', value: 71 }
    ]
  },
  {
    id: 'needs-enrichment',
    name: '✨ Needs Enrichment',
    description: 'Not yet enriched',
    icon: '✨',
    color: '#8b5cf6',
    filters: [{ field: 'enrichment_status', operator: 'not_equals', value: 'completed' }]
  },
  {
    id: 'decision-makers',
    name: '👔 Decision Makers',
    description: 'Identified as decision-makers',
    icon: '👔',
    color: '#3b82f6',
    filters: [{ field: 'enrichment_data->quick_enrich->persona_type', operator: 'equals', value: 'Decision-maker' }]
  },
  {
    id: 'recently-enriched',
    name: '🕐 Recently Enriched',
    description: 'Enriched in last 7 days',
    icon: '🕐',
    color: '#10b981',
    filters: [{ field: 'enriched_at', operator: 'gte', value: '7_days_ago' }]
  },
  {
    id: 'high-value',
    name: '💎 High Value',
    description: 'Hot + Decision Makers',
    icon: '💎',
    color: '#ec4899',
    filters: [
      { field: 'mdcp_score', operator: 'gte', value: 71 },
      { field: 'enrichment_data->quick_enrich->persona_type', operator: 'equals', value: 'Decision-maker' }
    ]
  }
];

export const SmartListsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customLists, setCustomLists] = useState<SmartList[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Mock data for demo
  useEffect(() => {
    // In production, fetch from API
    // fetchCustomLists();
  }, []);

  const loadPresetContacts = async (presetId: string) => {
    setLoading(true);
    setSelectedList(presetId);
    
    try {
      // In production: const response = await fetch(`/api/v3/smart-lists/preset/${presetId}/contacts`);
      // Mock data for demo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockContacts: Contact[] = [
        {
          id: '1',
          first_name: 'John',
          last_name: 'Smith',
          email: 'john@acme.com',
          company: 'Acme Inc',
          title: 'VP Sales',
          mdcp_score: 85,
          mdcp_tier: 'hot',
          enrichment_status: 'completed',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          first_name: 'Sarah',
          last_name: 'Johnson',
          email: 'sarah@techcorp.com',
          company: 'TechCorp',
          title: 'CEO',
          mdcp_score: 92,
          mdcp_tier: 'hot',
          enrichment_status: 'completed',
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

  const getScoreColor = (tier?: string) => {
    if (!tier) return '#6b7280';
    switch (tier.toLowerCase()) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div className="smart-lists-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-main">
          <Users size={32} />
          <div>
            <h1>Smart Lists</h1>
            <p>Dynamic contact segmentation with real-time filtering</p>
          </div>
        </div>
        {activeTab === 'custom' && (
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={20} />
            Create List
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          <Filter size={18} />
          Preset Lists
        </button>
        <button
          className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
          onClick={() => setActiveTab('custom')}
        >
          <Edit2 size={18} />
          Custom Lists
        </button>
      </div>

      <div className="content-grid">
        {/* Left: Lists */}
        <div className="lists-panel">
          {activeTab === 'presets' ? (
            <div className="preset-lists">
              {PRESET_LISTS.map(list => (
                <div
                  key={list.id}
                  className={`list-card ${selectedList === list.id ? 'active' : ''}`}
                  onClick={() => loadPresetContacts(list.id)}
                  style={{ borderLeftColor: list.color }}
                >
                  <div className="list-icon" style={{ backgroundColor: `${list.color}20` }}>
                    <span style={{ color: list.color }}>{list.icon}</span>
                  </div>
                  <div className="list-info">
                    <h3>{list.name}</h3>
                    <p>{list.description}</p>
                  </div>
                  <div className="list-count">
                    {selectedList === list.id ? contacts.length : '—'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="custom-lists">
              {customLists.length === 0 ? (
                <div className="empty-state">
                  <Filter size={48} />
                  <h3>No custom lists yet</h3>
                  <p>Create your first list to get started</p>
                  <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={20} />
                    Create List
                  </button>
                </div>
              ) : (
                customLists.map(list => (
                  <div
                    key={list.id}
                    className="list-card"
                    style={{ borderLeftColor: list.color }}
                  >
                    <div className="list-icon" style={{ backgroundColor: `${list.color}20` }}>
                      <span style={{ color: list.color }}>{list.icon}</span>
                    </div>
                    <div className="list-info">
                      <h3>{list.name}</h3>
                      <p>{list.description}</p>
                    </div>
                    <button className="btn-icon">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right: Contacts */}
        <div className="contacts-panel">
          {loading ? (
            <div className="loading-state">
              <RefreshCw className="spin" size={32} />
              <p>Loading contacts...</p>
            </div>
          ) : selectedList ? (
            <>
              <div className="contacts-header">
                <h2>Contacts ({contacts.length})</h2>
                <button className="btn-secondary">
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
              <div className="contacts-list">
                {contacts.map(contact => (
                  <div key={contact.id} className="contact-card">
                    <div className="contact-avatar">
                      {contact.first_name?.[0]}{contact.last_name?.[0]}
                    </div>
                    <div className="contact-info">
                      <h4>{contact.first_name} {contact.last_name}</h4>
                      <p className="contact-title">{contact.title || 'No title'}</p>
                      <p className="contact-company">{contact.company || 'No company'}</p>
                      <p className="contact-email">{contact.email}</p>
                    </div>
                    <div className="contact-score">
                      <div
                        className="score-badge"
                        style={{ backgroundColor: getScoreColor(contact.mdcp_tier) }}
                      >
                        {contact.mdcp_score || '—'}
                      </div>
                      <span className="score-label">{contact.mdcp_tier?.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Users size={48} />
              <h3>Select a list to view contacts</h3>
              <p>Choose a preset or custom list from the left panel</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartListsPage;
