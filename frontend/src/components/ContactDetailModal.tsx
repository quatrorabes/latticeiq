import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Phone, Building2, Briefcase, Globe, Linkedin, 
  Edit2, Save, Sparkles, Trash2, ExternalLink, User,
  TrendingUp, DollarSign, Calendar, MessageSquare,
  Target, Activity, Award, BarChart3
} from 'lucide-react';
import { Contact, updateContact, deleteContact } from '../api/contacts';
import { enrichContact } from '../api/enrichment';
import '../styles/ContactDetailModal.css';

interface Props {
  contact: Contact;
  onClose: () => void;
  onUpdate: () => void;
}

export const ContactDetailModal: React.FC<Props> = ({ contact, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isEnriching, setEnriching] = useState(false);
  const [editData, setEditData] = useState<Partial<Contact>>(contact);
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment' | 'activity'>('overview');

  useEffect(() => {
    setEditData(contact);
  }, [contact]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateContact(contact.id, editData);
      setIsEditing(false);
      onUpdate();
      alert('Contact updated successfully!');
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      await enrichContact(contact.id);
      alert('Enrichment started! This may take a minute.');
      setTimeout(() => {
        onUpdate();
      }, 3000);
    } catch (err: any) {
      alert(`Enrichment failed: ${err.message}`);
    } finally {
      setEnriching(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${contact.first_name} ${contact.last_name}? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteContact(contact.id);
      alert('Contact deleted successfully');
      onClose();
      onUpdate();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return '#6b7280';
    if (score >= 80) return '#ef4444';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#3b82f6';
    return '#6b7280';
  };

  const getTierBadge = (tier?: string) => {
    if (!tier) return null;
    const colors: Record<string, string> = {
      hot: '#ef4444',
      warm: '#f59e0b',
      cold: '#3b82f6'
    };
    return (
      <span 
        className="tier-badge" 
        style={{ backgroundColor: colors[tier.toLowerCase()] || '#6b7280' }}
      >
        {tier.toUpperCase()}
      </span>
    );
  };

  const enrichment = contact.enrichment_data || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-premium" onClick={(e) => e.stopPropagation()}>
        {/* Premium Header */}
        <div className="modal-header-premium">
          <div className="header-background"></div>
          <div className="header-content">
            <div className="header-top">
              <button className="btn-close" onClick={onClose}>
                <X size={24} />
              </button>
            </div>
            
            <div className="header-main">
              <div className="avatar-large">
                {contact.first_name?.[0]}{contact.last_name?.[0]}
              </div>
              <div className="header-info">
                {isEditing ? (
                  <div className="edit-name">
                    <input
                      type="text"
                      value={editData.first_name || ''}
                      onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                      placeholder="First name"
                      className="input-name"
                    />
                    <input
                      type="text"
                      value={editData.last_name || ''}
                      onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                      placeholder="Last name"
                      className="input-name"
                    />
                  </div>
                ) : (
                  <h1>{contact.first_name} {contact.last_name}</h1>
                )}
                
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.title || ''}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    placeholder="Title"
                    className="input-title"
                  />
                ) : (
                  <p className="subtitle">{contact.title || 'No title'} @ {contact.company || 'Unknown Company'}</p>
                )}

                <div className="quick-actions">
                  {!isEditing && (
                    <>
                      <a href={`mailto:${contact.email}`} className="quick-btn">
                        <Mail size={18} />
                        Email
                      </a>
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="quick-btn">
                          <Phone size={18} />
                          Call
                        </a>
                      )}
                      {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="quick-btn">
                          <Linkedin size={18} />
                          LinkedIn
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="header-actions">
                {isEditing ? (
                  <>
                    <button className="btn-action" onClick={() => setIsEditing(false)}>
                      <X size={20} />
                      Cancel
                    </button>
                    <button className="btn-action btn-primary" onClick={handleSave} disabled={isSaving}>
                      <Save size={20} />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-action" onClick={() => setIsEditing(true)}>
                      <Edit2 size={20} />
                      Edit
                    </button>
                    <button className="btn-action btn-glow" onClick={handleEnrich} disabled={isEnriching}>
                      <Sparkles size={20} />
                      {isEnriching ? 'Enriching...' : 'Enrich'}
                    </button>
                    <button className="btn-action btn-danger" onClick={handleDelete}>
                      <Trash2 size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score Dashboard */}
        <div className="score-dashboard">
          <div className="score-card-premium">
            <div className="score-icon mdcp">
              <Target size={24} />
            </div>
            <div className="score-details">
              <span className="score-label">MDCP Score</span>
              <div className="score-row">
                <span className="score-number" style={{ color: getScoreColor(contact.mdcp_score) }}>
                  {contact.mdcp_score || '—'}
                </span>
                {getTierBadge(contact.mdcp_tier)}
              </div>
            </div>
          </div>

          <div className="score-card-premium">
            <div className="score-icon bant">
              <DollarSign size={24} />
            </div>
            <div className="score-details">
              <span className="score-label">BANT Score</span>
              <div className="score-row">
                <span className="score-number" style={{ color: getScoreColor(contact.bant_score) }}>
                  {contact.bant_score || '—'}
                </span>
                {getTierBadge(contact.bant_tier)}
              </div>
            </div>
          </div>

          <div className="score-card-premium">
            <div className="score-icon spice">
              <Activity size={24} />
            </div>
            <div className="score-details">
              <span className="score-label">SPICE Score</span>
              <div className="score-row">
                <span className="score-number" style={{ color: getScoreColor(contact.spice_score) }}>
                  {contact.spice_score || '—'}
                </span>
                {getTierBadge(contact.spice_tier)}
              </div>
            </div>
          </div>

          <div className="score-card-premium highlight">
            <div className="score-icon overall">
              <Award size={24} />
            </div>
            <div className="score-details">
              <span className="score-label">Overall Score</span>
              <div className="score-row">
                <span className="score-number" style={{ color: getScoreColor(contact.overall_score) }}>
                  {contact.overall_score || '—'}
                </span>
                {getTierBadge(contact.overall_tier)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <User size={18} />
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'enrichment' ? 'active' : ''}`}
            onClick={() => setActiveTab('enrichment')}
          >
            <Sparkles size={18} />
            Enrichment
          </button>
          <button 
            className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <BarChart3 size={18} />
            Activity
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-body-premium">
          {activeTab === 'overview' && (
            <div className="tab-content">
              <div className="info-grid-premium">
                <div className="info-card">
                  <div className="info-card-header">
                    <Mail size={20} />
                    <span>Email</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="input-field"
                    />
                  ) : (
                    <a href={`mailto:${contact.email}`} className="info-value email">
                      {contact.email}
                    </a>
                  )}
                </div>

                <div className="info-card">
                  <div className="info-card-header">
                    <Phone size={20} />
                    <span>Phone</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      className="input-field"
                      placeholder="Phone number"
                    />
                  ) : (
                    <span className="info-value">{contact.phone || '—'}</span>
                  )}
                </div>

                <div className="info-card">
                  <div className="info-card-header">
                    <Building2 size={20} />
                    <span>Company</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.company || ''}
                      onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                      className="input-field"
                      placeholder="Company"
                    />
                  ) : (
                    <span className="info-value">{contact.company || '—'}</span>
                  )}
                </div>

                <div className="info-card">
                  <div className="info-card-header">
                    <Briefcase size={20} />
                    <span>Title</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.title || ''}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="input-field"
                      placeholder="Title"
                    />
                  ) : (
                    <span className="info-value">{contact.title || '—'}</span>
                  )}
                </div>

                {contact.website && (
                  <div className="info-card">
                    <div className="info-card-header">
                      <Globe size={20} />
                      <span>Website</span>
                    </div>
                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="info-value link">
                      {contact.website} <ExternalLink size={14} />
                    </a>
                  </div>
                )}

                {contact.linkedin_url && (
                  <div className="info-card">
                    <div className="info-card-header">
                      <Linkedin size={20} />
                      <span>LinkedIn</span>
                    </div>
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="info-value link">
                      View Profile <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>

              {/* Pipeline Info */}
              <div className="section-premium">
                <h3>Pipeline Details</h3>
                <div className="pipeline-cards">
                  <div className="pipeline-card">
                    <TrendingUp size={20} />
                    <div>
                      <span className="pipeline-label">Stage</span>
                      <span className="pipeline-value">{contact.pipeline_stage || 'New'}</span>
                    </div>
                  </div>
                  <div className="pipeline-card">
                    <DollarSign size={20} />
                    <div>
                      <span className="pipeline-label">Deal Value</span>
                      <span className="pipeline-value">
                        ${contact.deal_value?.toLocaleString() || '0'}
                      </span>
                    </div>
                  </div>
                  <div className="pipeline-card">
                    <Calendar size={20} />
                    <div>
                      <span className="pipeline-label">Added</span>
                      <span className="pipeline-value">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="tab-content">
              {contact.enrichment_status === 'completed' ? (
                <div className="enrichment-grid">
                  {enrichment.summary && (
                    <div className="enrichment-card feature">
                      <h4>📝 Summary</h4>
                      <p>{enrichment.summary}</p>
                    </div>
                  )}

                  {enrichment.opening_line && (
                    <div className="enrichment-card feature glow">
                      <h4>💬 Opening Line</h4>
                      <p className="opening-line">{enrichment.opening_line}</p>
                    </div>
                  )}

                  <div className="enrichment-row">
                    {enrichment.persona_type && (
                      <div className="enrichment-card">
                        <h4>👤 Persona</h4>
                        <span className="badge-premium">{enrichment.persona_type}</span>
                      </div>
                    )}

                    {enrichment.vertical && (
                      <div className="enrichment-card">
                        <h4>🏢 Vertical</h4>
                        <span className="badge-premium">{enrichment.vertical}</span>
                      </div>
                    )}
                  </div>

                  {enrichment.talking_points && enrichment.talking_points.length > 0 && (
                    <div className="enrichment-card feature">
                      <h4>🎯 Talking Points</h4>
                      <ul className="talking-points-premium">
                        {enrichment.talking_points.map((point: string, i: number) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {enrichment.company_description && (
                    <div className="enrichment-card">
                      <h4>🏢 Company Info</h4>
                      <p>{enrichment.company_description}</p>
                      {enrichment.company_size && (
                        <span className="meta-info">Size: {enrichment.company_size}</span>
                      )}
                      {enrichment.industry && (
                        <span className="meta-info">Industry: {enrichment.industry}</span>
                      )}
                    </div>
                  )}

                  {enrichment.recent_news && (
                    <div className="enrichment-card">
                      <h4>📰 Recent News</h4>
                      <p>{enrichment.recent_news}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-enrichment">
                  <Sparkles size={64} />
                  <h3>No enrichment data available</h3>
                  <p>Click the "Enrich" button to gather intelligence about this contact</p>
                  <button className="btn-enrich-large" onClick={handleEnrich} disabled={isEnriching}>
                    <Sparkles size={20} />
                    {isEnriching ? 'Enriching...' : 'Enrich Contact'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="tab-content">
              <div className="empty-enrichment">
                <Activity size={64} />
                <h3>Activity tracking coming soon</h3>
                <p>Track emails, calls, meetings, and deal progression</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactDetailModal;
