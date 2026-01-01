/**
 * src/pages/ContactDetailsExpanded.tsx
 * Expanded contact detail modal with all enrichment information
 */

import React from 'react'
import { Contact } from '../types'
import '../styles/ContactDetailsExpanded.css'

interface ContactDetailsExpandedProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
}

export const ContactDetailsExpanded: React.FC<ContactDetailsExpandedProps> = ({
  contact,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'company' | 'enrichment' | 'engagement'>('overview')

  if (!isOpen) return null

  return (
    <div className="expanded-modal-overlay" onClick={onClose}>
      <div className="expanded-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="expanded-header">
          <div className="header-main">
            <h2>{contact.first_name} {contact.last_name}</h2>
            <p className="header-title">{contact.title} at {contact.company_name}</p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Scores Banner */}
        <div className="scores-banner">
          <div className="score-item">
            <span className="score-label">MDCP Score</span>
            <span className="score-value">{contact.mdcp_score || 0}</span>
            <span className={`score-tier tier-${contact.mdcp_score && contact.mdcp_score >= 71 ? 'hot' : contact.mdcp_score && contact.mdcp_score >= 40 ? 'warm' : 'cold'}`}>
              {contact.mdcp_score && contact.mdcp_score >= 71 ? 'Hot' : contact.mdcp_score && contact.mdcp_score >= 40 ? 'Warm' : 'Cold'}
            </span>
          </div>
          <div className="score-item">
            <span className="score-label">BANT Score</span>
            <span className="score-value">{contact.bant_score || 0}</span>
          </div>
          <div className="score-item">
            <span className="score-label">SPICE Score</span>
            <span className="score-value">{contact.spice_score || 0}</span>
          </div>
          <div className="score-item overall">
            <span className="score-label">Status</span>
            <span className="score-value">{contact.enrichment_status || 'Pending'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="expanded-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => setActiveTab('company')}
          >
            Company
          </button>
          <button
            className={`tab-btn ${activeTab === 'enrichment' ? 'active' : ''}`}
            onClick={() => setActiveTab('enrichment')}
          >
            Enrichment
          </button>
          <button
            className={`tab-btn ${activeTab === 'engagement' ? 'active' : ''}`}
            onClick={() => setActiveTab('engagement')}
          >
            Engagement
          </button>
        </div>

        {/* Tab Content */}
        <div className="expanded-tabs-content">
          {activeTab === 'overview' && (
            <div className="tab-pane">
              <div className="info-grid">
                <div className="info-field">
                  <label>First Name</label>
                  <span className="info-value">{contact.first_name || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Last Name</label>
                  <span className="info-value">{contact.last_name || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Email</label>
                  <span className="info-value">{contact.email || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Phone</label>
                  <span className="info-value">{contact.phone || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Title</label>
                  <span className="info-value">{contact.title || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Company</label>
                  <span className="info-value">{contact.company_name || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Enrichment Status</label>
                  <span className={`status-badge status-${contact.enrichment_status?.toLowerCase() || 'pending'}`}>
                    {contact.enrichment_status || 'Pending'}
                  </span>
                </div>
                <div className="info-field">
                  <label>Created</label>
                  <span className="info-value">{contact.created_at ? new Date(contact.created_at).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>

              {contact.enrichment_data?.key_talking_points && Array.isArray(contact.enrichment_data.key_talking_points) && contact.enrichment_data.key_talking_points.length > 0 && (
                <div className="talking-points-section">
                  <h4>Key Talking Points</h4>
                  <ul className="talking-points-list">
                    {contact.enrichment_data.key_talking_points.map((point: any, idx: number) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'company' && (
            <div className="tab-pane">
              <div className="info-grid">
                <div className="info-field">
                  <label>Company Name</label>
                  <span className="info-value">{contact.enrichment_data?.company_name || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Website</label>
                  <span className="info-value">
                    {contact.enrichment_data?.company_website ? (
                      <a href={contact.enrichment_data.company_website} target="_blank" rel="noopener noreferrer" className="link-button">
                        Visit Site
                      </a>
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
                <div className="info-field">
                  <label>Industry</label>
                  <span className="info-value">{contact.enrichment_data?.industry || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Company Size</label>
                  <span className="info-value">{contact.enrichment_data?.company_size || 'N/A'}</span>
                </div>
              </div>

              {contact.enrichment_data?.company_description && (
                <div className="enrichment-section">
                  <h4>About Company</h4>
                  <p>{contact.enrichment_data.company_description}</p>
                </div>
              )}

              {contact.enrichment_data?.linkedin_company_url && (
                <div className="enrichment-section">
                  <h4>LinkedIn Profile</h4>
                  <a href={contact.enrichment_data.linkedin_company_url} target="_blank" rel="noopener noreferrer" className="link-button">
                    View Company on LinkedIn
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="tab-pane">
              {Array.isArray(contact.enrichment_data?.tech_stack) && contact.enrichment_data.tech_stack.length > 0 && (
                <div className="enrichment-section">
                  <h4>Tech Stack</h4>
                  <div className="tech-stack">
                    {contact.enrichment_data.tech_stack.map((tech: any, idx: number) => (
                      <span key={idx} className="tech-badge">{tech}</span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(contact.enrichment_data?.decision_makers) && contact.enrichment_data.decision_makers.length > 0 && (
                <div className="enrichment-section">
                  <h4>Decision Makers</h4>
                  <div className="decision-makers-list">
                    {contact.enrichment_data.decision_makers.map((dm: any, idx: number) => (
                      <div key={idx} className="decision-maker">
                        <div className="dm-name">{dm.name}</div>
                        <div className="dm-title">{dm.title}</div>
                        <div className="dm-email">{dm.email}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(contact.enrichment_data?.buying_signals) && contact.enrichment_data.buying_signals.length > 0 && (
                <div className="enrichment-section">
                  <h4>Buying Signals</h4>
                  <ul className="buying-signals-list">
                    {contact.enrichment_data.buying_signals.map((signal: any, idx: number) => (
                      <li key={idx}>{signal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {contact.enrichment_data?.recent_news && (
                <div className="enrichment-section">
                  <h4>Recent News</h4>
                  <p className="news-content">{contact.enrichment_data.recent_news}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'engagement' && (
            <div className="tab-pane">
              <div className="engagement-empty">
                <p>No engagement data yet</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Engagement metrics will appear here once campaigns are tracked
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="expanded-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary">
            Start Campaign
          </button>
        </div>
      </div>
    </div>
  )
}

export default ContactDetailsExpanded
