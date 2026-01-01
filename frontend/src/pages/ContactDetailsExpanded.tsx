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

  // Type-safe access to enrichment data
  const enrichmentData = contact.enrichment_data as Record<string, any> | undefined
  const companyName = contact.company || (enrichmentData?.company_name as string | undefined) || 'Unknown Company'

  return (
    <div className="expanded-modal-overlay" onClick={onClose}>
      <div className="expanded-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="expanded-header">
          <div className="header-main">
            <h2>{contact.first_name} {contact.last_name}</h2>
            <p className="header-title">{contact.title} at {companyName}</p>
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
                  <span className="info-value">{contact.company || 'N/A'}</span>
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

              {enrichmentData?.key_talking_points && Array.isArray(enrichmentData.key_talking_points) && enrichmentData.key_talking_points.length > 0 && (
                <div className="talking-points-section">
                  <h4>Key Talking Points</h4>
                  <ul className="talking-points-list">
                    {(enrichmentData.key_talking_points as string[]).map((point: string, idx: number) => (
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
                  <span className="info-value">{(enrichmentData?.company_name as string | undefined) || contact.company || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Website</label>
                  <span className="info-value">
                    {(enrichmentData?.company_website as string | undefined) ? (
                      <a href={enrichmentData?.company_website as string} target="_blank" rel="noopener noreferrer" className="link-button">
                        Visit Site
                      </a>
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
                <div className="info-field">
                  <label>Industry</label>
                  <span className="info-value">{(enrichmentData?.industry as string | undefined) || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Company Size</label>
                  <span className="info-value">{(enrichmentData?.company_size as string | undefined) || 'N/A'}</span>
                </div>
              </div>

              {(enrichmentData?.company_description as string | undefined) && (
                <div className="enrichment-section">
                  <h4>About Company</h4>
                  <p>{enrichmentData?.company_description as string}</p>
                </div>
              )}

              {(enrichmentData?.linkedin_company_url as string | undefined) && (
                <div className="enrichment-section">
                  <h4>LinkedIn Profile</h4>
                  <a href={enrichmentData?.linkedin_company_url as string} target="_blank" rel="noopener noreferrer" className="link-button">
                    View Company on LinkedIn
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="tab-pane">
              {Array.isArray(enrichmentData?.tech_stack) && enrichmentData.tech_stack.length > 0 && (
                <div className="enrichment-section">
                  <h4>Tech Stack</h4>
                  <div className="tech-stack">
                    {(enrichmentData.tech_stack as string[]).map((tech: string, idx: number) => (
                      <span key={idx} className="tech-badge">{tech}</span>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(enrichmentData?.decision_makers) && enrichmentData.decision_makers.length > 0 && (
                <div className="enrichment-section">
                  <h4>Decision Makers</h4>
                  <div className="decision-makers-list">
                    {(enrichmentData.decision_makers as Array<{name: string; title: string; email: string}>).map((dm, idx: number) => (
                      <div key={idx} className="decision-maker">
                        <div className="dm-name">{dm.name}</div>
                        <div className="dm-title">{dm.title}</div>
                        <div className="dm-email">{dm.email}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(enrichmentData?.buying_signals) && enrichmentData.buying_signals.length > 0 && (
                <div className="enrichment-section">
                  <h4>Buying Signals</h4>
                  <ul className="buying-signals-list">
                    {(enrichmentData.buying_signals as string[]).map((signal: string, idx: number) => (
                      <li key={idx}>{signal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(enrichmentData?.recent_news as string | undefined) && (
                <div className="enrichment-section">
                  <h4>Recent News</h4>
                  <p className="news-content">{enrichmentData?.recent_news as string}</p>
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