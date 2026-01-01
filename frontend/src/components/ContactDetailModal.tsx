import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, Building2, Briefcase, Globe, Linkedin, Edit2, Save, Sparkles, Trash2, ExternalLink } from 'lucide-react';
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
  const [formData, setFormData] = useState<Partial<Contact>>(contact);

  useEffect(() => {
    setFormData(contact);
  }, [contact]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateContact(contact.id, formData);
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

  const getScoreColor = (tier?: string) => {
    if (!tier) return '#6b7280';
    switch (tier.toLowerCase()) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const renderScoreCard = (label: string, score?: number, tier?: string) => {
    if (!score) return null;
    
    return (
      <div className="score-card">
        <div className="score-label">{label}</div>
        <div 
          className="score-value"
          style={{ backgroundColor: getScoreColor(tier) }}
        >
          {score}
        </div>
        <div className="score-tier">{tier?.toUpperCase() || 'N/A'}</div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <div className="contact-avatar-large">
              {contact.first_name?.[0]}{contact.last_name?.[0]}
            </div>
            <div>
              {isEditing ? (
                <div className="edit-name-group">
                  <input
                    type="text"
                    value={formData.first_name || ''}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="edit-input"
                    placeholder="First name"
                  />
                  <input
                    type="text"
                    value={formData.last_name || ''}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="edit-input"
                    placeholder="Last name"
                  />
                </div>
              ) : (
                <h2>{contact.first_name} {contact.last_name}</h2>
              )}
              {isEditing ? (
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="edit-input-small"
                  placeholder="Title"
                />
              ) : (
                <p className="contact-subtitle">{contact.title || 'No title'}</p>
              )}
            </div>
          </div>
          
          <div className="header-actions">
            {isEditing ? (
              <>
                <button className="btn-icon" onClick={() => setIsEditing(false)} title="Cancel">
                  <X size={20} />
                </button>
                <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                  <Save size={20} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button className="btn-icon" onClick={() => setIsEditing(true)} title="Edit">
                  <Edit2 size={20} />
                </button>
                <button 
                  className="btn-icon btn-enrich" 
                  onClick={handleEnrich} 
                  disabled={isEnriching}
                  title="Enrich"
                >
                  <Sparkles size={20} />
                </button>
                <button className="btn-icon btn-danger" onClick={handleDelete} title="Delete">
                  <Trash2 size={20} />
                </button>
                <button className="btn-icon" onClick={onClose} title="Close">
                  <X size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="modal-body">
          {/* Contact Info Section */}
          <div className="info-section">
            <h3>Contact Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <Mail size={18} />
                <div>
                  <label>Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="edit-input-small"
                    />
                  ) : (
                    <a href={`mailto:${contact.email}`} className="info-value email">
                      {contact.email}
                    </a>
                  )}
                </div>
              </div>

              <div className="info-item">
                <Phone size={18} />
                <div>
                  <label>Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="edit-input-small"
                      placeholder="Phone number"
                    />
                  ) : (
                    <span className="info-value">{contact.phone || '—'}</span>
                  )}
                </div>
              </div>

              <div className="info-item">
                <Building2 size={18} />
                <div>
                  <label>Company</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.company || ''}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="edit-input-small"
                      placeholder="Company name"
                    />
                  ) : (
                    <span className="info-value">{contact.company || '—'}</span>
                  )}
                </div>
              </div>

              <div className="info-item">
                <Briefcase size={18} />
                <div>
                  <label>Title</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="edit-input-small"
                      placeholder="Job title"
                    />
                  ) : (
                    <span className="info-value">{contact.title || '—'}</span>
                  )}
                </div>
              </div>

              {contact.linkedin_url && (
                <div className="info-item">
                  <Linkedin size={18} />
                  <div>
                    <label>LinkedIn</label>
                    <a 
                      href={contact.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="info-value link"
                    >
                      View Profile <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )}

              {contact.website && (
                <div className="info-item">
                  <Globe size={18} />
                  <div>
                    <label>Website</label>
                    <a 
                      href={contact.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="info-value link"
                    >
                      Visit Site <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scores Section */}
          {(contact.mdcp_score || contact.bant_score || contact.spice_score) && (
            <div className="info-section">
              <h3>Lead Scores</h3>
              <div className="scores-grid">
                {renderScoreCard('MDCP', contact.mdcp_score, contact.mdcp_tier)}
                {renderScoreCard('BANT', contact.bant_score, contact.bant_tier)}
                {renderScoreCard('SPICE', contact.spice_score, contact.spice_tier)}
                {renderScoreCard('Overall', contact.overall_score, contact.overall_tier)}
              </div>
            </div>
          )}

          {/* Enrichment Data */}
          {contact.enrichment_data && (
            <div className="info-section">
              <h3>Enrichment Insights</h3>
              <div className="enrichment-content">
                {contact.enrichment_data.summary && (
                  <div className="insight-item">
                    <strong>Summary:</strong>
                    <p>{contact.enrichment_data.summary}</p>
                  </div>
                )}
                {contact.enrichment_data.opening_line && (
                  <div className="insight-item">
                    <strong>Opening Line:</strong>
                    <p className="opening-line">{contact.enrichment_data.opening_line}</p>
                  </div>
                )}
                {contact.enrichment_data.persona_type && (
                  <div className="insight-item">
                    <strong>Persona:</strong>
                    <span className="badge">{contact.enrichment_data.persona_type}</span>
                  </div>
                )}
                {contact.enrichment_data.vertical && (
                  <div className="insight-item">
                    <strong>Vertical:</strong>
                    <span className="badge">{contact.enrichment_data.vertical}</span>
                  </div>
                )}
                {contact.enrichment_data.talking_points && (
                  <div className="insight-item">
                    <strong>Talking Points:</strong>
                    <ul className="talking-points">
                      {contact.enrichment_data.talking_points.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="info-section metadata-section">
            <div className="metadata-item">
              <span className="meta-label">Status:</span>
              <span className={`status-badge status-${contact.enrichment_status}`}>
                {contact.enrichment_status === 'completed' ? '✓ Enriched' : '⏳ Pending'}
              </span>
            </div>
            <div className="metadata-item">
              <span className="meta-label">Created:</span>
              <span>{new Date(contact.created_at).toLocaleString()}</span>
            </div>
            {contact.updated_at && (
              <div className="metadata-item">
                <span className="meta-label">Updated:</span>
                <span>{new Date(contact.updated_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailModal;
