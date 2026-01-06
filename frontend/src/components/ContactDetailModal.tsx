// frontend/src/components/ContactDetailModal.tsx
// Complete replacement - displays all 6 deep enrichment sections

import React, { useState, useEffect } from 'react';
import { X, Building2, TrendingUp, DollarSign, Users, Newspaper, Target, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface Contact {
  id: string;
  firstname?: string;
  lastname?: string;
  email: string;
  company?: string;
  job_title?: string;
  phone?: string;
  engagement_score?: number;
  engagement_status?: 'hot' | 'warm' | 'cold';
  mdcp_score?: number;
  mdcp_tier?: string;
  bant_score?: number;
  bant_tier?: string;
  spice_score?: number;
  spice_tier?: string;
  enrichment_data?: EnrichmentData;
  last_interaction?: string;
  created_at?: string;
}

interface EnrichmentData {
  company_overview?: CompanyOverview;
  market_position?: MarketPosition;
  key_financials?: KeyFinancials;
  executive_team?: ExecutiveTeam;
  recent_news?: RecentNews;
  engagement_signals?: EngagementSignals;
  enriched_at?: string;
  provider?: string;
}

interface CompanyOverview {
  description?: string;
  founded?: string;
  headquarters?: string;
  employee_count?: string;
  industry?: string;
  website?: string;
  linkedin_url?: string;
}

interface MarketPosition {
  market_share?: string;
  competitors?: string[];
  unique_value_proposition?: string;
  target_market?: string;
  growth_trajectory?: string;
}

interface KeyFinancials {
  revenue?: string;
  funding_total?: string;
  last_funding_round?: string;
  valuation?: string;
  profitability?: string;
  financial_health?: string;
}

interface ExecutiveTeam {
  ceo?: string;
  cto?: string;
  cfo?: string;
  key_decision_makers?: string[];
  recent_leadership_changes?: string;
}

interface RecentNews {
  headlines?: string[];
  press_releases?: string[];
  industry_mentions?: string[];
  sentiment?: string;
}

interface EngagementSignals {
  buying_signals?: string[];
  pain_points?: string[];
  technology_stack?: string[];
  recent_initiatives?: string[];
  recommended_approach?: string;
}

interface DeepEnrichResponse {
  contact_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: EnrichmentData;
  scores?: {
    mdcp: number;
    bant: number;
    spice: number;
  };
  error?: string;
  enriched_at?: string;
}

interface ContactDetailModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (contact: Contact) => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ContactDetailModal({ 
  contact, 
  isOpen, 
  onClose,
  onUpdate 
}: ContactDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment' | 'scores'>('overview');
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentData | null>(contact.enrichment_data || null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentStatus, setEnrichmentStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [scores, setScores] = useState({
    mdcp: contact.mdcp_score ?? 0,
    bant: contact.bant_score ?? 0,
    spice: contact.spice_score ?? 0
  });

  // Reset state when contact changes
  useEffect(() => {
    if (contact.enrichment_data) {
      setEnrichmentData(contact.enrichment_data);
      setEnrichmentStatus('completed');
    } else {
      setEnrichmentData(null);
      setEnrichmentStatus('idle');
    }
    setScores({
      mdcp: contact.mdcp_score ?? 0,
      bant: contact.bant_score ?? 0,
      spice: contact.spice_score ?? 0
    });
    setEnrichmentError(null);
  }, [contact.id]);

  if (!isOpen) return null;

  // ============================================================
  // DEEP ENRICHMENT HANDLER
  // ============================================================

  const handleDeepEnrich = async () => {
    setIsEnriching(true);
    setEnrichmentStatus('processing');
    setEnrichmentError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Trigger deep enrichment
      const response = await fetch(`${API_URL}/api/v3/enrichment/deep-enrich/${contact.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Enrichment failed: ${response.status}`);
      }

      // Poll for results (deep enrichment takes 10-18 seconds)
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const resultResponse = await fetch(`${API_URL}/api/v3/enrichment/deep-enrich/${contact.id}/result`, {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });

        if (resultResponse.ok) {
          const result: DeepEnrichResponse = await resultResponse.json();
          
          if (result.status === 'completed' && result.data) {
            setEnrichmentData(result.data);
            setEnrichmentStatus('completed');
            
            if (result.scores) {
              setScores({
                mdcp: result.scores.mdcp ?? 0,
                bant: result.scores.bant ?? 0,
                spice: result.scores.spice ?? 0
              });
            }
            
            // Notify parent of update
            if (onUpdate) {
              onUpdate({
                ...contact,
                enrichment_data: result.data,
                mdcp_score: result.scores?.mdcp,
                bant_score: result.scores?.bant,
                spice_score: result.scores?.spice
              });
            }
            
            setIsEnriching(false);
            return;
          } else if (result.status === 'failed') {
            throw new Error(result.error || 'Enrichment failed');
          }
        }
        
        attempts++;
      }
      
      throw new Error('Enrichment timed out. Please try again.');
      
    } catch (error) {
      console.error('Deep enrichment error:', error);
      setEnrichmentError(error instanceof Error ? error.message : 'Unknown error');
      setEnrichmentStatus('failed');
    } finally {
      setIsEnriching(false);
    }
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const getStatusBadge = (status: string | undefined) => {
    const styles: Record<string, string> = {
      hot: 'bg-red-500/20 text-red-400 border-red-500/30',
      warm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      cold: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    };
    return styles[status || 'cold'] || styles.cold;
  };

  const getTierBadge = (tier: string | undefined) => {
    const styles: Record<string, string> = {
      A: 'bg-emerald-500/20 text-emerald-400',
      B: 'bg-blue-500/20 text-blue-400',
      C: 'bg-amber-500/20 text-amber-400',
      D: 'bg-red-500/20 text-red-400'
    };
    return styles[tier || 'D'] || styles.D;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // ============================================================
  // ENRICHMENT SECTION RENDERERS
  // ============================================================

  const renderCompanyOverview = (data: CompanyOverview | undefined) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Building2 className="w-5 h-5 text-indigo-400" />
          <h4>Company Overview</h4>
        </div>
        <div className="section-content">
          {data.description && (
            <p className="description">{data.description}</p>
          )}
          <div className="detail-grid">
            {data.industry && <DetailItem label="Industry" value={data.industry} />}
            {data.founded && <DetailItem label="Founded" value={data.founded} />}
            {data.headquarters && <DetailItem label="Headquarters" value={data.headquarters} />}
            {data.employee_count && <DetailItem label="Employees" value={data.employee_count} />}
            {data.website && (
              <DetailItem 
                label="Website" 
                value={<a href={data.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{data.website}</a>} 
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMarketPosition = (data: MarketPosition | undefined) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h4>Market Position</h4>
        </div>
        <div className="section-content">
          {data.unique_value_proposition && (
            <p className="description">{data.unique_value_proposition}</p>
          )}
          <div className="detail-grid">
            {data.market_share && <DetailItem label="Market Share" value={data.market_share} />}
            {data.target_market && <DetailItem label="Target Market" value={data.target_market} />}
            {data.growth_trajectory && <DetailItem label="Growth" value={data.growth_trajectory} />}
          </div>
          {data.competitors && data.competitors.length > 0 && (
            <div className="list-section">
              <span className="list-label">Key Competitors:</span>
              <div className="tag-list">
                {data.competitors.map((competitor, i) => (
                  <span key={i} className="tag">{competitor}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderKeyFinancials = (data: KeyFinancials | undefined) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <DollarSign className="w-5 h-5 text-amber-400" />
          <h4>Key Financials</h4>
        </div>
        <div className="section-content">
          <div className="detail-grid">
            {data.revenue && <DetailItem label="Revenue" value={data.revenue} />}
            {data.funding_total && <DetailItem label="Total Funding" value={data.funding_total} />}
            {data.last_funding_round && <DetailItem label="Last Round" value={data.last_funding_round} />}
            {data.valuation && <DetailItem label="Valuation" value={data.valuation} />}
            {data.profitability && <DetailItem label="Profitability" value={data.profitability} />}
            {data.financial_health && <DetailItem label="Financial Health" value={data.financial_health} />}
          </div>
        </div>
      </div>
    );
  };

  const renderExecutiveTeam = (data: ExecutiveTeam | undefined) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Users className="w-5 h-5 text-purple-400" />
          <h4>Executive Team</h4>
        </div>
        <div className="section-content">
          <div className="detail-grid">
            {data.ceo && <DetailItem label="CEO" value={data.ceo} />}
            {data.cto && <DetailItem label="CTO" value={data.cto} />}
            {data.cfo && <DetailItem label="CFO" value={data.cfo} />}
          </div>
          {data.key_decision_makers && data.key_decision_makers.length > 0 && (
            <div className="list-section">
              <span className="list-label">Key Decision Makers:</span>
              <ul className="bullet-list">
                {data.key_decision_makers.map((person, i) => (
                  <li key={i}>{person}</li>
                ))}
              </ul>
            </div>
          )}
          {data.recent_leadership_changes && (
            <div className="note-box">
              <strong>Recent Changes:</strong> {data.recent_leadership_changes}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRecentNews = (data: RecentNews | undefined) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Newspaper className="w-5 h-5 text-cyan-400" />
          <h4>Recent News</h4>
        </div>
        <div className="section-content">
          {data.sentiment && (
            <div className={`sentiment-badge ${data.sentiment.toLowerCase()}`}>
              Sentiment: {data.sentiment}
            </div>
          )}
          {data.headlines && data.headlines.length > 0 && (
            <div className="list-section">
              <span className="list-label">Headlines:</span>
              <ul className="bullet-list">
                {data.headlines.map((headline, i) => (
                  <li key={i}>{headline}</li>
                ))}
              </ul>
            </div>
          )}
          {data.press_releases && data.press_releases.length > 0 && (
            <div className="list-section">
              <span className="list-label">Press Releases:</span>
              <ul className="bullet-list">
                {data.press_releases.map((pr, i) => (
                  <li key={i}>{pr}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEngagementSignals = (data: EngagementSignals | undefined) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Target className="w-5 h-5 text-rose-400" />
          <h4>Engagement Signals</h4>
        </div>
        <div className="section-content">
          {data.recommended_approach && (
            <div className="highlight-box">
              <strong>Recommended Approach:</strong>
              <p>{data.recommended_approach}</p>
            </div>
          )}
          {data.buying_signals && data.buying_signals.length > 0 && (
            <div className="list-section">
              <span className="list-label success">🔥 Buying Signals:</span>
              <ul className="bullet-list">
                {data.buying_signals.map((signal, i) => (
                  <li key={i}>{signal}</li>
                ))}
              </ul>
            </div>
          )}
          {data.pain_points && data.pain_points.length > 0 && (
            <div className="list-section">
              <span className="list-label warning">⚠️ Pain Points:</span>
              <ul className="bullet-list">
                {data.pain_points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {data.technology_stack && data.technology_stack.length > 0 && (
            <div className="list-section">
              <span className="list-label">Tech Stack:</span>
              <div className="tag-list">
                {data.technology_stack.map((tech, i) => (
                  <span key={i} className="tag tech">{tech}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // DETAIL ITEM COMPONENT
  // ============================================================

  const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-content">
            <div className="avatar">
              {(contact.firstname?.[0] || contact.email[0]).toUpperCase()}
            </div>
            <div className="header-info">
              <h2>
                {contact.firstname} {contact.lastname}
              </h2>
              <p className="subtitle">
                {contact.job_title && <span>{contact.job_title}</span>}
                {contact.job_title && contact.company && <span> at </span>}
                {contact.company && <span className="company">{contact.company}</span>}
              </p>
              <div className="badges">
                <span className={`status-badge ${getStatusBadge(contact.engagement_status)}`}>
                  {contact.engagement_status?.toUpperCase() || 'NEW'}
                </span>
                {contact.engagement_score !== undefined && (
                  <span className="score-badge">
                    Score: {contact.engagement_score}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'enrichment' ? 'active' : ''}`}
            onClick={() => setActiveTab('enrichment')}
          >
            Deep Enrichment
            {enrichmentData && <CheckCircle2 className="w-4 h-4 ml-1 text-emerald-400" />}
          </button>
          <button 
            className={`tab ${activeTab === 'scores' ? 'active' : ''}`}
            onClick={() => setActiveTab('scores')}
          >
            Scores
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="info-grid">
                <DetailItem label="Email" value={contact.email} />
                {contact.phone && <DetailItem label="Phone" value={contact.phone} />}
                {contact.company && <DetailItem label="Company" value={contact.company} />}
                {contact.job_title && <DetailItem label="Title" value={contact.job_title} />}
                <DetailItem label="Created" value={formatDate(contact.created_at)} />
                {contact.last_interaction && (
                  <DetailItem label="Last Interaction" value={formatDate(contact.last_interaction)} />
                )}
              </div>
            </div>
          )}

          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <div className="enrichment-tab">
              {/* Enrich Button */}
              <div className="enrich-action">
                <button 
                  className="enrich-btn"
                  onClick={handleDeepEnrich}
                  disabled={isEnriching}
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing... (10-18s)
                    </>
                  ) : enrichmentData ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Re-Enrich Contact
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4" />
                      Deep Enrich Contact
                    </>
                  )}
                </button>
                {enrichmentData?.enriched_at && (
                  <span className="enriched-at">
                    <Clock className="w-3 h-3" />
                    Last enriched: {formatDate(enrichmentData.enriched_at)}
                  </span>
                )}
              </div>

              {/* Error State */}
              {enrichmentError && (
                <div className="error-banner">
                  <AlertCircle className="w-4 h-4" />
                  {enrichmentError}
                </div>
              )}

              {/* Processing State */}
              {isEnriching && (
                <div className="processing-state">
                  <div className="processing-animation">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  </div>
                  <p>Analyzing company data from multiple sources...</p>
                  <div className="processing-steps">
                    <span className="step active">Gathering data</span>
                    <span className="step">Analyzing market</span>
                    <span className="step">Building profile</span>
                  </div>
                </div>
              )}

              {/* Enrichment Sections */}
              {enrichmentData && !isEnriching && (
                <div className="enrichment-sections">
                  {renderCompanyOverview(enrichmentData.company_overview)}
                  {renderMarketPosition(enrichmentData.market_position)}
                  {renderKeyFinancials(enrichmentData.key_financials)}
                  {renderExecutiveTeam(enrichmentData.executive_team)}
                  {renderRecentNews(enrichmentData.recent_news)}
                  {renderEngagementSignals(enrichmentData.engagement_signals)}
                </div>
              )}

              {/* Empty State */}
              {!enrichmentData && !isEnriching && (
                <div className="empty-state">
                  <Building2 className="w-12 h-12 text-slate-600" />
                  <h3>No Enrichment Data</h3>
                  <p>Click "Deep Enrich Contact" to gather comprehensive company intelligence including financials, market position, executives, and engagement signals.</p>
                </div>
              )}
            </div>
          )}

          {/* Scores Tab */}
          {activeTab === 'scores' && (
            <div className="scores-tab">
              <div className="score-cards">
                {/* MDCP Score */}
                <div className="score-card mdcp">
                  <div className="score-header">
                    <span className="score-title">MDCP</span>
                    <span className={`tier-badge ${getTierBadge(contact.mdcp_tier)}`}>
                      {contact.mdcp_tier || '-'}
                    </span>
                  </div>
                  <div className="score-value">{scores.mdcp}</div>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${scores.mdcp}%` }} />
                  </div>
                  <p className="score-desc">Money • Decision • Champion • Process</p>
                </div>

                {/* BANT Score */}
                <div className="score-card bant">
                  <div className="score-header">
                    <span className="score-title">BANT</span>
                    <span className={`tier-badge ${getTierBadge(contact.bant_tier)}`}>
                      {contact.bant_tier || '-'}
                    </span>
                  </div>
                  <div className="score-value">{scores.bant}</div>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${scores.bant}%` }} />
                  </div>
                  <p className="score-desc">Budget • Authority • Need • Timeline</p>
                </div>

                {/* SPICE Score */}
                <div className="score-card spice">
                  <div className="score-header">
                    <span className="score-title">SPICE</span>
                    <span className={`tier-badge ${getTierBadge(contact.spice_tier)}`}>
                      {contact.spice_tier || '-'}
                    </span>
                  </div>
                  <div className="score-value">{scores.spice}</div>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${scores.spice}%` }} />
                  </div>
                  <p className="score-desc">Situation • Problem • Implication • Consequence • Economic</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline Styles */}
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 1rem;
        }
        
        .modal-container {
          background: #1e293b;
          border-radius: 16px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(148, 163, 184, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.5rem;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .header-content {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }
        
        .avatar {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }
        
        .header-info h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
        }
        
        .header-info .subtitle {
          color: #94a3b8;
          font-size: 0.875rem;
          margin: 0.25rem 0;
        }
        
        .header-info .company {
          color: #6366f1;
          font-weight: 500;
        }
        
        .badges {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid;
        }
        
        .score-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
        }
        
        .close-btn {
          background: rgba(148, 163, 184, 0.1);
          border: none;
          border-radius: 8px;
          padding: 0.5rem;
          cursor: pointer;
          color: #94a3b8;
          transition: all 0.2s;
        }
        
        .close-btn:hover {
          background: rgba(148, 163, 184, 0.2);
          color: #f8fafc;
        }
        
        .tab-bar {
          display: flex;
          background: #0f172a;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .tab {
          flex: 1;
          padding: 1rem;
          background: none;
          border: none;
          color: #94a3b8;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-bottom: 2px solid transparent;
        }
        
        .tab:hover {
          color: #f8fafc;
          background: rgba(99, 102, 241, 0.05);
        }
        
        .tab.active {
          color: #6366f1;
          border-bottom-color: #6366f1;
          background: rgba(99, 102, 241, 0.1);
        }
        
        .modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }
        
        /* Overview Tab */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .detail-label {
          font-size: 0.75rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .detail-value {
          color: #f8fafc;
          font-size: 0.875rem;
        }
        
        /* Enrichment Tab */
        .enrich-action {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        
        .enrich-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .enrich-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
        }
        
        .enrich-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .enriched-at {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: #64748b;
          font-size: 0.75rem;
        }
        
        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #f87171;
          margin-bottom: 1rem;
        }
        
        .processing-state {
          text-align: center;
          padding: 3rem;
          color: #94a3b8;
        }
        
        .processing-animation {
          margin-bottom: 1rem;
        }
        
        .processing-steps {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-top: 1rem;
        }
        
        .processing-steps .step {
          padding: 0.25rem 0.75rem;
          background: rgba(148, 163, 184, 0.1);
          border-radius: 9999px;
          font-size: 0.75rem;
        }
        
        .processing-steps .step.active {
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
        }
        
        .enrichment-sections {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .enrichment-section {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 12px;
          overflow: hidden;
        }
        
        .section-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          background: rgba(148, 163, 184, 0.05);
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .section-header h4 {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #f8fafc;
        }
        
        .section-content {
          padding: 1.25rem;
        }
        
        .section-content .description {
          color: #cbd5e1;
          font-size: 0.875rem;
          line-height: 1.6;
          margin: 0 0 1rem 0;
        }
        
        .section-content .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        
        .list-section {
          margin-top: 1rem;
        }
        
        .list-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #94a3b8;
          display: block;
          margin-bottom: 0.5rem;
        }
        
        .list-label.success { color: #4ade80; }
        .list-label.warning { color: #fbbf24; }
        
        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .tag {
          padding: 0.25rem 0.75rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 9999px;
          font-size: 0.75rem;
          color: #a5b4fc;
        }
        
        .tag.tech {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.2);
          color: #86efac;
        }
        
        .bullet-list {
          margin: 0;
          padding-left: 1.25rem;
          color: #cbd5e1;
          font-size: 0.875rem;
        }
        
        .bullet-list li {
          margin-bottom: 0.25rem;
        }
        
        .note-box, .highlight-box {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(148, 163, 184, 0.05);
          border-radius: 8px;
          font-size: 0.875rem;
          color: #cbd5e1;
        }
        
        .highlight-box {
          background: rgba(99, 102, 241, 0.1);
          border-left: 3px solid #6366f1;
        }
        
        .highlight-box strong {
          color: #a5b4fc;
          display: block;
          margin-bottom: 0.25rem;
        }
        
        .sentiment-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        
        .sentiment-badge.positive {
          background: rgba(34, 197, 94, 0.1);
          color: #86efac;
        }
        
        .sentiment-badge.neutral {
          background: rgba(148, 163, 184, 0.1);
          color: #94a3b8;
        }
        
        .sentiment-badge.negative {
          background: rgba(239, 68, 68, 0.1);
          color: #f87171;
        }
        
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #64748b;
        }
        
        .empty-state h3 {
          margin: 1rem 0 0.5rem;
          color: #94a3b8;
        }
        
        .empty-state p {
          max-width: 400px;
          margin: 0 auto;
          font-size: 0.875rem;
          line-height: 1.6;
        }
        
        /* Scores Tab */
        .score-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        
        @media (max-width: 640px) {
          .score-cards {
            grid-template-columns: 1fr;
          }
        }
        
        .score-card {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        }
        
        .score-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .score-title {
          font-weight: 700;
          font-size: 0.875rem;
          color: #f8fafc;
        }
        
        .tier-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        
        .score-value {
          font-size: 3rem;
          font-weight: 300;
          color: #f8fafc;
          line-height: 1;
          margin-bottom: 1rem;
        }
        
        .score-bar {
          height: 6px;
          background: rgba(148, 163, 184, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }
        
        .score-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
        }
        
        .score-card.mdcp .score-fill { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
        .score-card.bant .score-fill { background: linear-gradient(90deg, #22c55e, #10b981); }
        .score-card.spice .score-fill { background: linear-gradient(90deg, #f59e0b, #f97316); }
        
        .score-desc {
          font-size: 0.7rem;
          color: #64748b;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
