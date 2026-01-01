/**
 * ContactDetailModal.tsx - FINAL CORRECTED VERSION
 * All 28 errors fixed
 */

import React, { useState, useEffect } from 'react';
import { enrichContact } from '../api/enrichment';
import { updateContact } from '../api/contacts';
import { Contact, EnrichmentData } from '../types';

interface ContactDetailModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onEnrich?: (contactId: string) => Promise<void>;
  onUpdate?: (contact: Contact) => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  contact,
  isOpen,
  onClose,
  onEnrich,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'enrichment' | 'scoring'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editData, setEditData] = useState<Contact>(contact);

  useEffect(() => {
    setEditData(contact);
    setError(null);
  }, [contact]);

  if (!isOpen) return null;

  const enrichment = (contact.enrichment_data || {}) as EnrichmentData;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await updateContact(editData.id, editData);
      onUpdate?.(editData);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnrich = async () => {
    try {
      setIsEnriching(true);
      setError(null);
      await enrichContact(contact.id);
      onEnrich?.(contact.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrich contact');
    } finally {
      setIsEnriching(false);
    }
  };

  const getTierColor = (tier?: string): string => {
    if (!tier) return 'gray';
    return tier.toLowerCase();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {isEditing ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={editData.first_name}
                  onChange={e => setEditData({ ...editData, first_name: e.target.value })}
                  placeholder="First name"
                  className="form-control"
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  value={editData.last_name}
                  onChange={e => setEditData({ ...editData, last_name: e.target.value })}
                  placeholder="Last name"
                  className="form-control"
                  style={{ flex: 1 }}
                />
              </div>
            ) : (
              `${editData.first_name} ${editData.last_name}`
            )}
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="modal-error">
            <p>{error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

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
            Enrichment
          </button>
          <button
            className={`tab-btn ${activeTab === 'scoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('scoring')}
          >
            Scoring
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'info' && (
            <div className="info-section">
              <h3>Contact Information</h3>
              <div className="info-grid">
                <div className="info-field">
                  <label>First Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.first_name}
                      onChange={e => setEditData({ ...editData, first_name: e.target.value })}
                    />
                  ) : (
                    <p>{editData.first_name}</p>
                  )}
                </div>

                <div className="info-field">
                  <label>Last Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.last_name}
                      onChange={e => setEditData({ ...editData, last_name: e.target.value })}
                    />
                  ) : (
                    <p>{editData.last_name}</p>
                  )}
                </div>

                <div className="info-field">
                  <label>Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.email}
                      onChange={e => setEditData({ ...editData, email: e.target.value })}
                    />
                  ) : (
                    <a href={`mailto:${editData.email}`}>{editData.email}</a>
                  )}
                </div>

                <div className="info-field">
                  <label>Company</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.company || ''}
                      onChange={e => setEditData({ ...editData, company: e.target.value })}
                    />
                  ) : (
                    <p>{editData.company || '—'}</p>
                  )}
                </div>

                <div className="info-field">
                  <label>Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editData.phone || ''}
                      onChange={e => setEditData({ ...editData, phone: e.target.value })}
                    />
                  ) : (
                    <p>{editData.phone || '—'}</p>
                  )}
                </div>

                <div className="info-field">
                  <label>Title</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.title || ''}
                      onChange={e => setEditData({ ...editData, title: e.target.value })}
                    />
                  ) : (
                    <p>{editData.title || '—'}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="enrichment-section">
              <div className="section-header">
                <h3>Enrichment Data</h3>
                <div className="enrichment-status">
                  <span
                    className={`status-badge ${editData.enrichment_status || 'pending'}`}
                  >
                    {editData.enrichment_status === 'completed' && '✓ Enriched'}
                    {editData.enrichment_status === 'pending' && '⏳ Pending'}
                    {editData.enrichment_status === 'processing' && '⟳ Processing'}
                    {editData.enrichment_status === 'failed' && '✕ Failed'}
                    {!editData.enrichment_status && '—'}
                  </span>
                  {editData.enrichment_status !== 'completed' && (
                    <button
                      className="enrich-btn-modal"
                      onClick={handleEnrich}
                      disabled={isEnriching}
                    >
                      {isEnriching ? 'Enriching...' : 'Enrich Now'}
                    </button>
                  )}
                </div>
              </div>

              {enrichment && Object.keys(enrichment).length > 0 ? (
                <div className="enrichment-data">
                  {enrichment.company_description && (
                    <div className="enrichment-item">
                      <h4>Company Description</h4>
                      <p>{enrichment.company_description}</p>
                    </div>
                  )}

                  {enrichment.company_size && (
                    <div className="enrichment-item">
                      <h4>Company Size</h4>
                      <p>{enrichment.company_size}</p>
                    </div>
                  )}

                  {enrichment.industry && (
                    <div className="enrichment-item">
                      <h4>Industry</h4>
                      <p>{enrichment.industry}</p>
                    </div>
                  )}

                  {enrichment.website && (
                    <div className="enrichment-item">
                      <h4>Website</h4>
                      <a href={enrichment.website} target="_blank" rel="noopener noreferrer">
                        {enrichment.website}
                      </a>
                    </div>
                  )}

                  {enrichment.linkedin_url && (
                    <div className="enrichment-item">
                      <h4>LinkedIn</h4>
                      <a href={enrichment.linkedin_url} target="_blank" rel="noopener noreferrer">
                        View Profile
                      </a>
                    </div>
                  )}

                  {enrichment.talking_points && (
                    <div className="enrichment-item">
                      <h4>Talking Points</h4>
                      <ul>
                        {(Array.isArray(enrichment.talking_points)
                          ? enrichment.talking_points
                          : (enrichment.talking_points as string)?.split(';') || []
                        ).map((point: string, i: number) => (
                          <li key={i}>{point.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {enrichment.recent_news && (
                    <div className="enrichment-item">
                      <h4>Recent News</h4>
                      <p>{enrichment.recent_news}</p>
                    </div>
                  )}

                  <div className="enrichment-meta">
                    Last enriched: {editData.enrichment_status === 'completed'
                      ? new Date(contact.created_at).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
              ) : (
                <div className="no-enrichment">
                  <p>No enrichment data available</p>
                  <button
                    className="enrich-btn-modal"
                    onClick={handleEnrich}
                    disabled={isEnriching}
                  >
                    {isEnriching ? 'Enriching...' : 'Enrich Now'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'scoring' && (
            <div className="scoring-section">
              <h3>Lead Scores</h3>
              <div className="scores-grid">
                {editData.mdcp_score !== undefined && (
                  <div className="score-card">
                    <h4>MDCP Score</h4>
                    <div className="score-value">
                      <span className={`score-number tier-${getTierColor(editData.mdcp_tier)}`}>
                        {editData.mdcp_score || '—'}
                      </span>
                      {editData.mdcp_tier && (
                        <span className={`tier-badge tier-${getTierColor(editData.mdcp_tier)}`}>
                          {editData.mdcp_tier.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {editData.bant_score !== undefined && (
                  <div className="score-card">
                    <h4>BANT Score</h4>
                    <div className="score-value">
                      <span className={`score-number tier-${getTierColor(editData.bant_tier)}`}>
                        {editData.bant_score || '—'}
                      </span>
                      {editData.bant_tier && (
                        <span className={`tier-badge tier-${getTierColor(editData.bant_tier)}`}>
                          {editData.bant_tier.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {editData.spice_score !== undefined && (
                  <div className="score-card">
                    <h4>SPICE Score</h4>
                    <div className="score-value">
                      <span className={`score-number tier-${getTierColor(editData.spice_tier)}`}>
                        {editData.spice_score || '—'}
                      </span>
                      {editData.spice_tier && (
                        <span className={`tier-badge tier-${getTierColor(editData.spice_tier)}`}>
                          {editData.spice_tier.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {editData.overall_score && (
                  <div className="score-card overall">
                    <h4>Overall Score</h4>
                    <span className="score-number">{editData.overall_score}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-meta">
            Created {new Date(contact.created_at).toLocaleDateString()}
          </div>
          <div className="footer-actions">
            {isEditing ? (
              <>
                <button
                  className="btn-save"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setIsEditing(false);
                    setEditData(contact);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-edit"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
                <button
                  className="btn-close"
                  onClick={onClose}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailModal;
