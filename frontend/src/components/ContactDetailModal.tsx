import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Phone, Building2, Briefcase, Globe, Linkedin, 
  Edit2, Save, Sparkles, Trash2, ExternalLink, Target,
  DollarSign, Activity, Award, RefreshCw, CheckCircle
} from 'lucide-react';
import { Contact, updateContact, deleteContact, fetchContact } from '../api/contacts';
import { enrichContact } from '../api/enrichment';
import { calculateScores } from '../api/scoring';
import '../styles/ContactDetailModal.css';

interface Props {
  contact: Contact;
  onClose: () => void;
  onUpdate?: () => void;
}

export const ContactDetailModal: React.FC<Props> = ({ 
  contact: initialContact, 
  onClose, 
  onUpdate 
}) => {
  const [contact, setContact] = useState<Contact>(initialContact);
  const [activeTab, setActiveTab] = useState<'info' | 'enrichment' | 'scoring'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [editData, setEditData] = useState<Partial<Contact>>(initialContact);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setContact(initialContact);
    setEditData(initialContact);
  }, [initialContact]);

  const refreshContact = async () => {
    try {
      const fresh = await fetchContact(contact.id);
      setContact(fresh);
      setEditData(fresh);
    } catch (err) {
      console.error('Failed to refresh contact:', err);
    }
  };

  const enrichment = (contact.enrichment_data || {}) as Record<string, any>;

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await updateContact(contact.id, editData);
      await refreshContact();
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Contact saved successfully!' });
      onUpdate?.();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnrich = async () => {
    setIsEnriching(true);
    setMessage(null);
    try {
      await enrichContact(contact.id);
      await refreshContact();
      setMessage({ type: 'success', text: 'Enrichment complete! Scores calculated.' });
      onUpdate?.();
      setActiveTab('enrichment');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Enrichment failed' });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleScore = async () => {
    setIsScoring(true);
    setMessage(null);
    try {
      await calculateScores(contact.id);
      await refreshContact();
      setMessage({ type: 'success', text: 'Scores recalculated!' });
      onUpdate?.();
      setActiveTab('scoring');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Scoring failed' });
    } finally {
      setIsScoring(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${contact.first_name} ${contact.last_name}? This cannot be undone.`)) return;
    try {
      await deleteContact(contact.id);
      onUpdate?.();
      onClose();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Delete failed' });
    }
  };

  const getTierColor = (tier?: string): string => {
    if (!tier) return 'gray';
    switch (tier.toLowerCase()) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const ScoreCard = ({ label, score, tier, icon: Icon }: { 
    label: string; 
    score?: number; 
    tier?: string; 
    icon: React.ElementType 
  }) => (
    <div className={`score-card ${label.toLowerCase()}`}>
      <div className="score-card-icon" style={{ backgroundColor: getTierColor(tier) }}>
        <Icon size={24} />
      </div>
      <div className="score-card-content">
        <span className="score-label">{label}</span>
        <div className="score-row">
          <span className="score-number" style={{ color: getTierColor(tier) }}>
            {score ?? '—'}
          </span>
          {tier && (
            <span className="tier-badge" style={{ backgroundColor: getTierColor(tier) }}>
              {tier.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <div className="avatar-large">
              {contact.first_name?.[0]}{contact.last_name?.[0]}
            </div>
            <div className="header-info">
              {isEditing ? (
                <div className="edit-name-row">
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
                <h2>{contact.first_name} {contact.last_name}</h2>
              )}
              <p className="header-subtitle">
                {contact.title || 'No title'} @ {contact.company || 'Unknown'}
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`message-banner ${message.type}`}>
            {message.type === 'success' && <CheckCircle size={18} />}
            {message.text}
          </div>
        )}

        {/* Action Buttons */}
        <div className="modal-actions">
          {isEditing ? (
            <>
              <button className="btn-action btn-save" onClick={handleSave} disabled={isSaving}>
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-action" onClick={() => { setIsEditing(false); setEditData(contact); }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button className="btn-action" onClick={() => setIsEditing(true)}>
                <Edit2 size={18} />
                Edit
              </button>
              <button className="btn-action btn-enrich" onClick={handleEnrich} disabled={isEnriching}>
                <Sparkles size={18} className={isEnriching ? 'spin' : ''} />
                {isEnriching ? 'Enriching...' : 'Enrich'}
              </button>
              <button className="btn-action btn-score" onClick={handleScore} disabled={isScoring}>
                <RefreshCw size={18} className={isScoring ? 'spin' : ''} />
                {isScoring ? 'Scoring...' : 'Re-Score'}
              </button>
              <button className="btn-action btn-delete" onClick={handleDelete}>
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button 
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Contact Info
          </button>
          <button 
            className={`tab-btn ${activeTab === 'enrichment' ? 'active' : ''}`}
            onClick={() => setActiveTab('enrichment')}
          >
            Enrichment {contact.enrichment_status === 'completed' && '✓'}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'scoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('scoring')}
          >
            Scoring {contact.overall_score && '✓'}
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-body">
          {/* INFO TAB */}
          {activeTab === 'info' && (
            <div className="tab-pane">
              <div className="info-grid">
                <div className="info-field">
                  <label><Mail size={16} /> Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="input-field"
                    />
                  ) : (
                    <a href={`mailto:${contact.email}`} className="info-value link">
                      {contact.email}
                    </a>
                  )}
                </div>

                <div className="info-field">
                  <label><Phone size={16} /> Phone</label>
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

                <div className="info-field">
                  <label><Building2 size={16} /> Company</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.company || ''}
                      onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                      className="input-field"
                    />
                  ) : (
                    <span className="info-value">{contact.company || '—'}</span>
                  )}
                </div>

                <div className="info-field">
                  <label><Briefcase size={16} /> Title</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.title || ''}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="input-field"
                    />
                  ) : (
                    <span className="info-value">{contact.title || '—'}</span>
                  )}
                </div>

                {(contact.linkedin_url || isEditing) && (
                  <div className="info-field">
                    <label><Linkedin size={16} /> LinkedIn</label>
                    {isEditing ? (
                      <input
                        type="url"
                        value={editData.linkedin_url || ''}
                        onChange={(e) => setEditData({ ...editData, linkedin_url: e.target.value })}
                        className="input-field"
                        placeholder="LinkedIn URL"
                      />
                    ) : (
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="info-value link">
                        View Profile <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                )}

                {(contact.website || isEditing) && (
                  <div className="info-field">
                    <label><Globe size={16} /> Website</label>
                    {isEditing ? (
                      <input
                        type="url"
                        value={editData.website || ''}
                        onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                        className="input-field"
                        placeholder="Website URL"
                      />
                    ) : (
                      <a href={contact.website} target="_blank" rel="noopener noreferrer" className="info-value link">
                        {contact.website} <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="info-meta">
                <span>Created: {new Date(contact.created_at).toLocaleDateString()}</span>
                {contact.updated_at && (
                  <span>Updated: {new Date(contact.updated_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          )}

          {/* ENRICHMENT TAB */}
          {activeTab === 'enrichment' && (
            <div className="tab-pane">
              <div className="enrichment-status-bar">
                <span className={`status-badge status-${contact.enrichment_status || 'pending'}`}>
                  {contact.enrichment_status === 'completed' ? '✓ Enriched' : 
                   contact.enrichment_status === 'processing' ? '⏳ Processing' : '○ Not Enriched'}
                </span>
                {contact.enrichment_status !== 'completed' && (
                  <button className="btn-enrich-inline" onClick={handleEnrich} disabled={isEnriching}>
                    <Sparkles size={16} />
                    {isEnriching ? 'Enriching...' : 'Enrich Now'}
                  </button>
                )}
              </div>

              {Object.keys(enrichment).length > 0 ? (
                <div className="enrichment-data">
                  {enrichment.summary && (
                    <div className="enrichment-section">
                      <h4>📝 Summary</h4>
                      <p>{enrichment.summary}</p>
                    </div>
                  )}

                  {enrichment.opening_line && (
                    <div className="enrichment-section highlight">
                      <h4>💬 AI Opening Line</h4>
                      <p className="opening-line">{enrichment.opening_line}</p>
                    </div>
                  )}

                  {enrichment.persona_type && (
                    <div className="enrichment-section">
                      <h4>👤 Persona</h4>
                      <span className="enrichment-badge">{enrichment.persona_type}</span>
                    </div>
                  )}

                  {enrichment.talking_points && (
                    <div className="enrichment-section">
                      <h4>🎯 Talking Points</h4>
                      <ul className="talking-points">
                        {(Array.isArray(enrichment.talking_points) 
                          ? enrichment.talking_points 
                          : (enrichment.talking_points as string)?.split('\n')
                        ).map((point: string, i: number) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {enrichment.company_description && (
                    <div className="enrichment-section">
                      <h4>🏢 Company Info</h4>
                      <p>{enrichment.company_description}</p>
                      <div className="enrichment-meta">
                        {enrichment.company_size && <span>Size: {enrichment.company_size}</span>}
                        {enrichment.industry && <span>Industry: {enrichment.industry}</span>}
                      </div>
                    </div>
                  )}

                  {enrichment.recent_news && (
                    <div className="enrichment-section">
                      <h4>📰 Recent News</h4>
                      <p>{enrichment.recent_news}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <Sparkles size={48} />
                  <h3>No enrichment data yet</h3>
                  <p>Click "Enrich Now" to gather AI-powered insights</p>
                </div>
              )}
            </div>
          )}

          {/* SCORING TAB */}
          {activeTab === 'scoring' && (
            <div className="tab-pane">
              <div className="scoring-header">
                <h3>Lead Scores</h3>
                <button className="btn-rescore" onClick={handleScore} disabled={isScoring}>
                  <RefreshCw size={16} className={isScoring ? 'spin' : ''} />
                  {isScoring ? 'Calculating...' : 'Recalculate'}
                </button>
              </div>

              <div className="scores-grid">
                <ScoreCard 
                  label="MDCP" 
                  score={contact.mdcp_score} 
                  tier={contact.mdcp_tier} 
                  icon={Target} 
                />
                <ScoreCard 
                  label="BANT" 
                  score={contact.bant_score} 
                  tier={contact.bant_tier} 
                  icon={DollarSign} 
                />
                <ScoreCard 
                  label="SPICE" 
                  score={contact.spice_score} 
                  tier={contact.spice_tier} 
                  icon={Activity} 
                />
                <ScoreCard 
                  label="Overall" 
                  score={contact.overall_score} 
                  tier={contact.overall_tier} 
                  icon={Award} 
                />
              </div>

              <div className="scoring-legend">
                <div className="legend-item">
                  <span className="legend-dot hot"></span>
                  <span>Hot (75+)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot warm"></span>
                  <span>Warm (50-74)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot cold"></span>
                  <span>Cold (&lt;50)</span>
                </div>
              </div>

              {!contact.overall_score && (
                <div className="empty-state">
                  <Target size={48} />
                  <h3>No scores calculated yet</h3>
                  <p>Enrich the contact first, or click "Recalculate" to generate scores</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactDetailModal;
