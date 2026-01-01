/**
 * src/pages/ContactDetailsExpanded.tsx
 * Full enrichment view with all contact data
 * 
 * Tabs:
 * - Overview (basic info + scores)
 * - Company (all company enrichment)
 * - Enrichment (tech stack, decision makers, signals)
 * - Engagement (history, campaign tracking)
 */

import React, { useState } from 'react';
import { Contact } from '../types';
import '../styles/ContactDetailsExpanded.css';

interface ContactDetailsExpandedProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
}

export const ContactDetailsExpanded: React.FC<ContactDetailsExpandedProps> = ({
  contact,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'company' | 'enrichment' | 'engagement'>('overview');

  if (!isOpen) return null;

  return (
    <div className="expanded-modal-overlay" onClick={onClose}>
      <div className="expanded-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="expanded-header">
          <div className="header-main">
            <h2>{contact.first_name} {contact.last_name}</h2>
            <p className="header-title">{contact.title || 'No title'} @ {contact.company || 'No company'}</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Scores Overview */}
        <div className="scores-banner">
          <div className="score-item">
            <span className="score-label">MDCP</span>
            <span className="score-value">{contact.mdcp_score || 0}</span>
            <span className={`score-tier tier-${contact.mdcp_tier || 'cold'}`}>
              {contact.mdcp_tier?.toUpperCase() || 'N/A'}
            </span>
          </div>
          <div className="score-item">
            <span className="score-label">BANT</span>
            <span className="score-value">{contact.bant_score || 0}</span>
            <span className={`score-tier tier-${contact.bant_tier || 'cold'}`}>
              {contact.bant_tier?.toUpperCase() || 'N/A'}
            </span>
          </div>
          <div className="score-item">
            <span className="score-label">SPICE</span>
            <span className="score-value">{contact.spice_score || 0}</span>
            <span className={`score-tier tier-${contact.spice_tier || 'cold'}`}>
              {contact.spice_tier?.toUpperCase() || 'N/A'}
            </span>
          </div>
          <div className="score-item overall">
            <span className="score-label">Overall</span>
            <span className="score-value">{contact.overall_score || 0}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="expanded-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            👤 Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => setActiveTab('company')}
          >
            🏢 Company
          </button>
          <button
            className={`tab-btn ${activeTab === 'enrichment' ? 'active' : ''}`}
            onClick={() => setActiveTab('enrichment')}
          >
            ✨ Enrichment
          </button>
          <button
            className={`tab-btn ${activeTab === 'engagement' ? 'active' : ''}`}
            onClick={() => setActiveTab('engagement')}
          >
            📊 Engagement
          </button>
        </div>

        {/* Tab Content */}
        <div className="expanded-tabs-content">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="tab-pane">
              <div className="info-grid">
                <div className="info-field">
                  <label>Email</label>
                  <div className="info-value">{contact.email}</div>
                </div>
                <div className="info-field">
                  <label>Phone</label>
                  <div className="info-value">{contact.phone || '—'}</div>
                </div>
                <div className="info-field">
                  <label>Title</label>
                  <div className="info-value">{contact.title || '—'}</div>
                </div>
                <div className="info-field">
                  <label>Company</label>
                  <div className="info-value">{contact.company || '—'}</div>
                </div>
                <div className="info-field">
                  <label>Created</label>
                  <div className="info-value">{new Date(contact.created_at).toLocaleDateString()}</div>
                </div>
                <div className="info-field">
                  <label>Status</label>
                  <div className="info-value">
                    <span className={`status-badge status-${contact.enrichment_status}`}>
                      {contact.enrichment_status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>
                </div>
              </div>

              {contact.enrichment_data?.talking_points && (
                <div className="talking-points-section">
                  <h4>💬 Key Talking Points</h4>
                  <ul className="talking-points-list">
                    {(Array.isArray(contact.enrichment_data.talking_points)
                      ? contact.enrichment_data.talking_points
                      : [contact.enrichment_data.talking_points]
                    ).map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* COMPANY TAB */}
          {activeTab === 'company' && (
            <div className="tab-pane">
              <div className="info-grid">
                <div className="info-field">
                  <label>Company</label>
                  <div className="info-value">{contact.company || '—'}</div>
                </div>
                <div className="info-field">
                  <label>Domain</label>
                  <div className="info-value">{contact.enrichment_data?.website || '—'}</div>
                </div>
                <div className="info-field">
                  <label>Industry</label>
                  <div className="info-value">{contact.enrichment_data?.industry || '—'}</div>
                </div>
                <div className="info-field">
                  <label>Company Size</label>
                  <div className="info-value">{contact.enrichment_data?.company_size || '—'}</div>
                </div>
                <div className="info-field">
                  <label>Description</label>
                  <div className="info-value">{contact.enrichment_data?.company_description || '—'}</div>
                </div>
              </div>

              {contact.enrichment_data?.linkedin_url && (
                <div className="linkedin-section">
                  <h4>🔗 LinkedIn</h4>
                  <a href={contact.enrichment_data.linkedin_url} target="_blank" rel="noopener noreferrer" className="link-button">
                    View Profile →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ENRICHMENT TAB */}
          {activeTab === 'enrichment' && (
            <div className="tab-pane">
              {/* Tech Stack */}
              {contact.enrichment_data?.tech_stack && (
                <div className="enrichment-section">
                  <h4>💻 Tech Stack</h4>
                  <div className="tech-stack">
                    {(Array.isArray(contact.enrichment_data.tech_stack)
                      ? contact.enrichment_data.tech_stack
                      : [contact.enrichment_data.tech_stack]
                    ).map((tech, i) => (
                      <span key={i} className="tech-badge">{tech}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision Makers */}
              {contact.enrichment_data?.decision_makers && (
                <div className="enrichment-section">
                  <h4>👥 Decision Makers</h4>
                  <div className="decision-makers-list">
                    {(Array.isArray(contact.enrichment_data.decision_makers)
                      ? contact.enrichment_data.decision_makers
                      : [contact.enrichment_data.decision_makers]
                    ).map((dm: any, i) => {
                      const dmObj = typeof dm === 'object' ? dm : {name: dm};
                      return (
                        <div key={i} className="decision-maker">
                          <div className="dm-name">{dmObj.name || 'Unknown'}</div>
                          <div className="dm-title">{dmObj.title || 'N/A'}</div>
                          {dmObj.email && <div className="dm-email">{dmObj.email}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Buying Signals */}
              {contact.enrichment_data?.buying_signals && (
                <div className="enrichment-section">
                  <h4>🎯 Buying Signals</h4>
                  <ul className="buying-signals-list">
                    {(Array.isArray(contact.enrichment_data.buying_signals)
                      ? contact.enrichment_data.buying_signals
                      : [contact.enrichment_data.buying_signals]
                    ).map((signal, i) => (
                      <li key={i}>{signal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recent News */}
              {contact.enrichment_data?.recent_news && (
                <div className="enrichment-section">
                  <h4>📰 Recent News</h4>
                  <p className="news-content">{contact.enrichment_data.recent_news}</p>
                </div>
              )}
            </div>
          )}

          {/* ENGAGEMENT TAB */}
          {activeTab === 'engagement' && (
            <div className="tab-pane">
              <div className="info-grid">
                <div className="info-field">
                  <label>Last Contacted</label>
                  <div className="info-value">—</div>
                </div>
                <div className="info-field">
                  <label>Contact Count</label>
                  <div className="info-value">—</div>
                </div>
                <div className="info-field">
                  <label>Response Rate</label>
                  <div className="info-value">—</div>
                </div>
              </div>

              <div className="engagement-empty">
                <p>📧 Engagement tracking comes from campaign integration</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="expanded-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary">Enrich Contact</button>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailsExpanded;
