// frontend/src/components/ContactDetailModal.tsx

import React, { useState, useEffect } from 'react';
import { 
  X, Building2, Target, Loader2, RefreshCw, 
  AlertCircle, CheckCircle2, Clock, User, 
  AlertTriangle, MessageSquare, Zap, Mail, Phone,
  Send, Copy, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Contact } from '../types';

interface ContactDetailModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (contact: Contact) => void;
}

export default function ContactDetailModal({ 
  contact, 
  isOpen, 
  onClose,
  onUpdate 
}: ContactDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment' | 'outreach' | 'scores'>('overview');
  const [enrichmentData, setEnrichmentData] = useState<any>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isQuickEnriching, setIsQuickEnriching] = useState(false);
  const [enrichmentStatus, setEnrichmentStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [scores, setScores] = useState({
    mdcp: contact.mdcp_score ?? 0,
    bant: contact.bant_score ?? 0,
    spice: contact.spice_score ?? 0
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Load enrichment data on mount
  useEffect(() => {
    if (contact.enrichment_data) {
      // Handle nested data structure
      const data = contact.enrichment_data.data || contact.enrichment_data;
      setEnrichmentData(data);
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
  }, [contact.id, contact.enrichment_data, contact.mdcp_score, contact.bant_score, contact.spice_score]);

  if (!isOpen) return null;

  // ============================================================
  // QUICK ENRICHMENT HANDLER
  // ============================================================

  const handleQuickEnrich = async () => {
    setIsQuickEnriching(true);
    setEnrichmentError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/v3/enrichment/quick/${contact.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Quick enrichment failed: ${response.status}`);
      }

      const result = await response.json();
      if (result.enrichment_data) {
        const data = result.enrichment_data.data || result.enrichment_data;
        setEnrichmentData(data);
        setEnrichmentStatus('completed');
        
        if (onUpdate) {
          onUpdate({ ...contact, enrichment_data: result.enrichment_data });
        }
      }
    } catch (error) {
      console.error('Quick enrichment error:', error);
      setEnrichmentError(error instanceof Error ? error.message : 'Quick enrichment failed');
    } finally {
      setIsQuickEnriching(false);
    }
  };

  // ============================================================
  // DEEP ENRICHMENT HANDLER
  // ============================================================

  const handleDeepEnrich = async () => {
    setIsEnriching(true);
    setEnrichmentStatus('processing');
    setEnrichmentError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
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

      // Poll for results
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const resultResponse = await fetch(`${API_URL}/api/v3/enrichment/deep-enrich/${contact.id}/result`, {
          headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
        });

        if (resultResponse.ok) {
          const result = await resultResponse.json();
          console.log('Poll attempt', attempts, ':', result);
          
          // Check for enrichment data in various locations
          const hasData = result.contact_profile || 
                         result.data?.contact_profile || 
                         result.enrichment_data?.contact_profile;
          
          if (hasData) {
            // Extract the actual data
            const enrichData = result.contact_profile 
              ? result 
              : (result.data?.contact_profile ? result.data : result.enrichment_data);
            
            setEnrichmentData(enrichData);
            setEnrichmentStatus('completed');
            
            const scoresData = result.scores || result.data?.scores || enrichData?.scores;
            if (scoresData) {
              setScores({
                mdcp: scoresData.mdcp ?? 0,
                bant: scoresData.bant ?? 0,
                spice: scoresData.spice ?? 0
              });
            }
            
            if (onUpdate) {
              onUpdate({
                ...contact,
                enrichment_data: { data: enrichData },
                mdcp_score: scoresData?.mdcp,
                bant_score: scoresData?.bant,
                spice_score: scoresData?.spice
              });
            }
            
            setIsEnriching(false);
            return;
          }
          
          if (result.status === 'failed') {
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
  // UTILITY FUNCTIONS
  // ============================================================

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // Extract bullet text (handles both string and {text: string} formats)
  const getBulletText = (bullet: any): string => {
    if (typeof bullet === 'string') return bullet;
    if (bullet?.text) return bullet.text;
    return String(bullet);
  };

  const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || 'N/A'}</span>
    </div>
  );

  // ============================================================
  // ENRICHMENT SECTION RENDERERS
  // ============================================================

  const renderContactProfile = (data: any) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <User className="w-5 h-5 text-indigo-400" />
          <h4>Contact Profile</h4>
        </div>
        <div className="section-content">
          {data.headline && <p className="description">{data.headline}</p>}
          {data.rolesummary && <p className="description">{data.rolesummary}</p>}
          <div className="detail-grid">
            {data.seniority && <DetailItem label="Seniority" value={data.seniority} />}
            {data.decisionmakingstyle && <DetailItem label="Decision Style" value={data.decisionmakingstyle} />}
            {data.influencelevel && <DetailItem label="Influence" value={data.influencelevel} />}
          </div>
          {data.backgroundbullets && data.backgroundbullets.length > 0 && (
            <div className="list-section">
              <span className="list-label">Background:</span>
              <ul className="bullet-list">
                {data.backgroundbullets.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCompanyProfile = (data: any) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <h4>Company Profile</h4>
        </div>
        <div className="section-content">
          {data.oneliner && <p className="description">{data.oneliner}</p>}
          <div className="detail-grid">
            {data.industry && <DetailItem label="Industry" value={data.industry} />}
            {data.sizesegment && <DetailItem label="Size" value={data.sizesegment} />}
            {data.region && <DetailItem label="Region" value={data.region} />}
            {data.fundingstatus && <DetailItem label="Funding" value={data.fundingstatus} />}
          </div>
          {data.keyproductsservices && data.keyproductsservices.length > 0 && (
            <div className="list-section">
              <span className="list-label">Products/Services:</span>
              <div className="tag-list">
                {data.keyproductsservices.map((item: any, i: number) => (
                  <span key={i} className="tag">{getBulletText(item)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCurrentFocus = (data: any) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Target className="w-5 h-5 text-amber-400" />
          <h4>Current Focus</h4>
        </div>
        <div className="section-content">
          {data.strategicinitiatives && data.strategicinitiatives.length > 0 && (
            <div className="list-section">
              <span className="list-label success">🎯 Strategic Initiatives:</span>
              <ul className="bullet-list">
                {data.strategicinitiatives.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.recentprojects && data.recentprojects.length > 0 && (
            <div className="list-section">
              <span className="list-label">Recent Projects:</span>
              <ul className="bullet-list">
                {data.recentprojects.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.primarykpis && data.primarykpis.length > 0 && (
            <div className="list-section">
              <span className="list-label">Primary KPIs:</span>
              <ul className="bullet-list">
                {data.primarykpis.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBuyingSignals = (data: any) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Zap className="w-5 h-5 text-green-400" />
          <h4>Buying Signals</h4>
        </div>
        <div className="section-content">
          {data.recentnews && data.recentnews.length > 0 && (
            <div className="list-section">
              <span className="list-label success">📰 Recent News:</span>
              <ul className="bullet-list">
                {data.recentnews.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.timingtriggers && data.timingtriggers.length > 0 && (
            <div className="list-section">
              <span className="list-label warning">⏰ Timing Triggers:</span>
              <ul className="bullet-list">
                {data.timingtriggers.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.hiringsignals && data.hiringsignals.length > 0 && (
            <div className="list-section">
              <span className="list-label">Hiring Signals:</span>
              <ul className="bullet-list">
                {data.hiringsignals.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRisksAndObjections = (data: any) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h4>Risks & Objections</h4>
        </div>
        <div className="section-content">
          {data.riskbullets && data.riskbullets.length > 0 && (
            <div className="list-section">
              <span className="list-label warning">⚠️ Risk Factors:</span>
              <ul className="bullet-list">
                {data.riskbullets.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.likelyobjections && data.likelyobjections.length > 0 && (
            <div className="list-section">
              <span className="list-label">Likely Objections:</span>
              <ul className="bullet-list">
                {data.likelyobjections.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.landmines && data.landmines.length > 0 && (
            <div className="list-section">
              <span className="list-label">Landmines to Avoid:</span>
              <ul className="bullet-list">
                {data.landmines.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMessaging = (data: any) => {
    if (!data) return null;
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          <h4>Recommended Messaging</h4>
        </div>
        <div className="section-content">
          {data.coldopeners && data.coldopeners.length > 0 && (
            <div className="list-section">
              <span className="list-label success">💬 Cold Openers:</span>
              <ul className="bullet-list">
                {data.coldopeners.map((item: any, i: number) => (
                  <li key={i} className="copyable" onClick={() => copyToClipboard(getBulletText(item), `opener-${i}`)}>
                    {getBulletText(item)}
                    {copiedField === `opener-${i}` && <span className="copied-badge">Copied!</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.valueprops && data.valueprops.length > 0 && (
            <div className="list-section">
              <span className="list-label">Value Props:</span>
              <ul className="bullet-list">
                {data.valueprops.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {data.calltoactionideas && data.calltoactionideas.length > 0 && (
            <div className="list-section">
              <span className="list-label">Call to Action Ideas:</span>
              <ul className="bullet-list">
                {data.calltoactionideas.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email?.split('@')[0] || 'Unknown';
  const initials = contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-content">
            <div className="avatar">{initials}</div>
            <div className="header-info">
              <h2>{contactName}</h2>
              <p className="subtitle">
                {contact.title && <span>{contact.title}</span>}
                {contact.title && contact.company && <span> at </span>}
                {contact.company && <span className="company">{contact.company}</span>}
              </p>
              <div className="badges">
                <span className={`status-badge ${getStatusBadge(contact.engagement_status)}`}>
                  {contact.engagement_status?.toUpperCase() || 'NEW'}
                </span>
                {contact.engagement_score !== undefined && (
                  <span className="score-badge">Score: {contact.engagement_score}</span>
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
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Overview
          </button>
          <button className={`tab ${activeTab === 'enrichment' ? 'active' : ''}`} onClick={() => setActiveTab('enrichment')}>
            Deep Enrichment
            {enrichmentData && <CheckCircle2 className="w-4 h-4 ml-1 text-emerald-400" />}
          </button>
          <button className={`tab ${activeTab === 'outreach' ? 'active' : ''}`} onClick={() => setActiveTab('outreach')}>
            Outreach
          </button>
          <button className={`tab ${activeTab === 'scores' ? 'active' : ''}`} onClick={() => setActiveTab('scores')}>
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
                {contact.title && <DetailItem label="Title" value={contact.title} />}
                <DetailItem label="Created" value={formatDate(contact.created_at as unknown as string)} />
              </div>
              
              {/* Quick Actions */}
              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="action-buttons">
                  <button 
                    className="action-btn quick-enrich"
                    onClick={handleQuickEnrich}
                    disabled={isQuickEnriching}
                  >
                    {isQuickEnriching ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Quick Enriching...</>
                    ) : (
                      <><Zap className="w-4 h-4" /> Quick Enrich</>
                    )}
                  </button>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="action-btn email">
                      <Mail className="w-4 h-4" /> Send Email
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="action-btn phone">
                      <Phone className="w-4 h-4" /> Call
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <div className="enrichment-tab">
              <div className="enrich-action">
                <button className="enrich-btn" onClick={handleDeepEnrich} disabled={isEnriching}>
                  {isEnriching ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing... (10-18s)</>
                  ) : enrichmentData ? (
                    <><RefreshCw className="w-4 h-4" /> Re-Enrich Contact</>
                  ) : (
                    <><Target className="w-4 h-4" /> Deep Enrich Contact</>
                  )}
                </button>
                {enrichmentData?.meta?.generatedat && (
                  <span className="enriched-at">
                    <Clock className="w-3 h-3" /> Last enriched: {formatDate(enrichmentData.meta.generatedat)}
                  </span>
                )}
              </div>

              {enrichmentError && (
                <div className="error-banner">
                  <AlertCircle className="w-4 h-4" /> {enrichmentError}
                </div>
              )}

              {isEnriching && (
                <div className="processing-state">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  <p>Analyzing contact from multiple sources...</p>
                  <div className="processing-steps">
                    <span className="step active">Gathering data</span>
                    <span className="step">Analyzing market</span>
                    <span className="step">Building profile</span>
                  </div>
                </div>
              )}

              {enrichmentData && !isEnriching && (
                <div className="enrichment-sections">
                  {renderContactProfile(enrichmentData.contact_profile)}
                  {renderCompanyProfile(enrichmentData.company_profile)}
                  {renderCurrentFocus(enrichmentData.current_focus)}
                  {renderBuyingSignals(enrichmentData.buying_signals)}
                  {renderRisksAndObjections(enrichmentData.risks_and_objections)}
                  {renderMessaging(enrichmentData.messaging)}
                </div>
              )}

              {!enrichmentData && !isEnriching && (
                <div className="empty-state">
                  <Building2 className="w-12 h-12 text-slate-600" />
                  <h3>No Enrichment Data</h3>
                  <p>Click "Deep Enrich Contact" to gather comprehensive intelligence including contact profile, company details, buying signals, and personalized messaging recommendations.</p>
                </div>
              )}
            </div>
          )}

          {/* Outreach Tab */}
          {activeTab === 'outreach' && (
            <div className="outreach-tab">
              <div className="outreach-section">
                <h3>📧 Email Outreach</h3>
                {enrichmentData?.messaging?.coldopeners ? (
                  <div className="outreach-templates">
                    {enrichmentData.messaging.coldopeners.map((opener: any, i: number) => (
                      <div key={i} className="template-card">
                        <p>{getBulletText(opener)}</p>
                        <div className="template-actions">
                          <button onClick={() => copyToClipboard(getBulletText(opener), `email-${i}`)}>
                            <Copy className="w-4 h-4" />
                            {copiedField === `email-${i}` ? 'Copied!' : 'Copy'}
                          </button>
                          {contact.email && (
                            <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Quick question, ${contact.first_name}`)}&body=${encodeURIComponent(getBulletText(opener))}`}>
                              <Send className="w-4 h-4" /> Send
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">Run Deep Enrichment to generate personalized outreach templates.</p>
                )}
              </div>

              <div className="outreach-section">
                <h3>📞 Call Scripts</h3>
                {enrichmentData?.messaging?.valueprops ? (
                  <div className="outreach-templates">
                    {enrichmentData.messaging.valueprops.map((prop: any, i: number) => (
                      <div key={i} className="template-card">
                        <p>{getBulletText(prop)}</p>
                        <button onClick={() => copyToClipboard(getBulletText(prop), `call-${i}`)}>
                          <Copy className="w-4 h-4" />
                          {copiedField === `call-${i}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">Run Deep Enrichment to generate call talking points.</p>
                )}
              </div>
            </div>
          )}

          {/* Scores Tab */}
          {activeTab === 'scores' && (
            <div className="scores-tab">
              <div className="score-cards">
                <div className="score-card mdcp">
                  <div className="score-header">
                    <span className="score-title">MDCP</span>
                    <span className={`tier-badge ${getTierBadge(contact.mdcp_tier || undefined)}`}>
                      {contact.mdcp_tier || '-'}
                    </span>
                  </div>
                  <div className="score-value">{scores.mdcp}</div>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${scores.mdcp}%` }} />
                  </div>
                  <p className="score-desc">Money • Decision • Champion • Process</p>
                </div>

                <div className="score-card bant">
                  <div className="score-header">
                    <span className="score-title">BANT</span>
                    <span className={`tier-badge ${getTierBadge(contact.bant_tier || undefined)}`}>
                      {contact.bant_tier || '-'}
                    </span>
                  </div>
                  <div className="score-value">{scores.bant}</div>
                  <div className="score-bar">
                    <div className="score-fill" style={{ width: `${scores.bant}%` }} />
                  </div>
                  <p className="score-desc">Budget • Authority • Need • Timeline</p>
                </div>

                <div className="score-card spice">
                  <div className="score-header">
                    <span className="score-title">SPICE</span>
                    <span className={`tier-badge ${getTierBadge(contact.spice_tier || undefined)}`}>
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
        .header-content { display: flex; gap: 1rem; align-items: flex-start; }
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
        .header-info h2 { font-size: 1.25rem; font-weight: 700; color: #f8fafc; margin: 0; }
        .header-info .subtitle { color: #94a3b8; font-size: 0.875rem; margin: 0.25rem 0; }
        .header-info .company { color: #6366f1; font-weight: 500; }
        .badges { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
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
        .close-btn:hover { background: rgba(148, 163, 184, 0.2); color: #f8fafc; }
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
        .tab:hover { color: #f8fafc; background: rgba(99, 102, 241, 0.05); }
        .tab.active { color: #6366f1; border-bottom-color: #6366f1; background: rgba(99, 102, 241, 0.1); }
        .modal-content { flex: 1; overflow-y: auto; padding: 1.5rem; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .detail-item { display: flex; flex-direction: column; gap: 0.25rem; }
        .detail-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .detail-value { color: #f8fafc; font-size: 0.875rem; }
        .quick-actions { margin-top: 1.5rem; }
        .quick-actions h3 { color: #f8fafc; font-size: 0.875rem; margin-bottom: 0.75rem; }
        .action-buttons { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          border: none;
        }
        .action-btn.quick-enrich { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
        .action-btn.quick-enrich:hover:not(:disabled) { transform: translateY(-2px); }
        .action-btn.quick-enrich:disabled { opacity: 0.7; cursor: not-allowed; }
        .action-btn.email { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; }
        .action-btn.phone { background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .enrich-action { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
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
        .enrich-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3); }
        .enrich-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .enriched-at { display: flex; align-items: center; gap: 0.25rem; color: #64748b; font-size: 0.75rem; }
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
        .processing-state { text-align: center; padding: 3rem; color: #94a3b8; }
        .processing-steps { display: flex; justify-content: center; gap: 1rem; margin-top: 1rem; }
        .processing-steps .step {
          padding: 0.25rem 0.75rem;
          background: rgba(148, 163, 184, 0.1);
          border-radius: 9999px;
          font-size: 0.75rem;
        }
        .processing-steps .step.active { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; }
        .enrichment-sections { display: flex; flex-direction: column; gap: 1.5rem; }
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
        .section-header h4 { margin: 0; font-size: 0.875rem; font-weight: 600; color: #f8fafc; }
        .section-content { padding: 1.25rem; }
        .section-content .description { color: #cbd5e1; font-size: 0.875rem; line-height: 1.6; margin: 0 0 1rem 0; }
        .section-content .detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        .list-section { margin-top: 1rem; }
        .list-label { font-size: 0.75rem; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 0.5rem; }
        .list-label.success { color: #4ade80; }
        .list-label.warning { color: #fbbf24; }
        .tag-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .tag {
          padding: 0.25rem 0.75rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 9999px;
          font-size: 0.75rem;
          color: #a5b4fc;
        }
        .bullet-list { margin: 0; padding-left: 1.25rem; color: #cbd5e1; font-size: 0.875rem; }
        .bullet-list li { margin-bottom: 0.5rem; line-height: 1.5; }
        .bullet-list li.copyable { cursor: pointer; }
        .bullet-list li.copyable:hover { color: #a5b4fc; }
        .copied-badge { margin-left: 0.5rem; font-size: 0.7rem; color: #4ade80; }
        .empty-state { text-align: center; padding: 4rem 2rem; color: #64748b; }
        .empty-state h3 { margin: 1rem 0 0.5rem; color: #94a3b8; }
        .empty-state p { max-width: 400px; margin: 0 auto; font-size: 0.875rem; line-height: 1.6; }
        .outreach-tab { display: flex; flex-direction: column; gap: 2rem; }
        .outreach-section h3 { color: #f8fafc; font-size: 1rem; margin-bottom: 1rem; }
        .outreach-templates { display: flex; flex-direction: column; gap: 1rem; }
        .template-card {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 8px;
          padding: 1rem;
        }
        .template-card p { color: #cbd5e1; font-size: 0.875rem; line-height: 1.6; margin: 0 0 0.75rem 0; }
        .template-actions { display: flex; gap: 0.5rem; }
        .template-actions button, .template-actions a {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.375rem 0.75rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 6px;
          color: #a5b4fc;
          font-size: 0.75rem;
          cursor: pointer;
          text-decoration: none;
        }
        .template-actions button:hover, .template-actions a:hover { background: rgba(99, 102, 241, 0.2); }
        .no-data { color: #64748b; font-size: 0.875rem; }
        .score-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        @media (max-width: 640px) { .score-cards { grid-template-columns: 1fr; } }
        .score-card {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        }
        .score-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .score-title { font-weight: 700; font-size: 0.875rem; color: #f8fafc; }
        .tier-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
        .score-value { font-size: 3rem; font-weight: 300; color: #f8fafc; line-height: 1; margin-bottom: 1rem; }
        .score-bar { height: 6px; background: rgba(148, 163, 184, 0.1); border-radius: 3px; overflow: hidden; margin-bottom: 0.75rem; }
        .score-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
        .score-card.mdcp .score-fill { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
        .score-card.bant .score-fill { background: linear-gradient(90deg, #22c55e, #10b981); }
        .score-card.spice .score-fill { background: linear-gradient(90deg, #f59e0b, #f97316); }
        .score-desc { font-size: 0.7rem; color: #64748b; margin: 0; }
      `}</style>
    </div>
  );
}
