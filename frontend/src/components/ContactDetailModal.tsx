// frontend/src/components/ContactDetailModal.tsx

import React, { useState, useEffect } from 'react';
import {
  X, Mail, Phone, Building2, Briefcase, Globe, Linkedin,
  Edit2, Save, Sparkles, Trash2, ExternalLink, Target,
  DollarSign, Activity, Award, RefreshCw, CheckCircle,
  Brain, MessageSquare, Lightbulb, AlertCircle
} from 'lucide-react';
import { Contact, updateContact, deleteContact, fetchContact } from '../api/contacts';
import { enrichContact, deepEnrichContact, getEnrichmentResult, pollEnrichmentComplete } from '../api/enrichment';
import { calculateScores } from '../api/scoring';
import { supabase } from '../lib/supabaseClient';
import { UnifiedEnrichmentResult, LegacyEnrichmentData } from '../types/enrichment';
import '../styles/ContactDetailModal.css';

interface Props {
  contact: Contact;
  onClose: () => void;
  onUpdate?: () => void;
}

interface ParsedProfile {
  professionalProfile: string;
  companyProfile: string;
  painPoints: string[];
  talkingPoints: string[];
  keyInsights: string[];
}

/**
 * Transform UnifiedEnrichmentResult into ParsedProfile for display
 */
function transformDeepEnrichment(enrichment: UnifiedEnrichmentResult): ParsedProfile {
  const sections: ParsedProfile = {
    professionalProfile: '',
    companyProfile: '',
    painPoints: [],
    talkingPoints: [],
    keyInsights: [],
  };

  // Professional Profile section
  if (enrichment.contact_profile) {
    const cp = enrichment.contact_profile;
    let profText = `## PROFESSIONAL PROFILE\n`;
    if (cp.headline) profText += `${cp.headline}\n`;
    if (cp.role_summary) profText += `${cp.role_summary}\n`;
    if (cp.seniority) profText += `Seniority: ${cp.seniority}\n`;
    
    profText += `\n### Background\n`;
    if (cp.background_bullets && Array.isArray(cp.background_bullets)) {
      cp.background_bullets.forEach(bullet => {
        profText += `- ${bullet.text}\n`;
      });
    }
    sections.professionalProfile = profText;
  }

  // Company Profile section
  if (enrichment.company_profile) {
    const company = enrichment.company_profile;
    let companyText = `## COMPANY PROFILE\n`;
    if (company.one_liner) companyText += `${company.one_liner}\n`;
    if (company.industry) companyText += `Industry: ${company.industry}\n`;
    if (company.size_segment) companyText += `Size: ${company.size_segment}\n`;
    if (company.region) companyText += `Region: ${company.region}\n`;
    
    companyText += `\n### Key Products/Services\n`;
    if (company.key_products_or_services && Array.isArray(company.key_products_or_services)) {
      company.key_products_or_services.forEach(product => {
        companyText += `- ${product.text}\n`;
      });
    }
    sections.companyProfile = companyText;
  }

  // Extract pain points from risks & objections
  if (enrichment.risks_and_objections?.risk_bullets && Array.isArray(enrichment.risks_and_objections.risk_bullets)) {
    sections.painPoints = enrichment.risks_and_objections.risk_bullets.map(b => b.text);
  }

  // Extract talking points from messaging & current focus
  const talkingPoints: string[] = [];
  if (enrichment.messaging?.cold_openers) {
    enrichment.messaging.cold_openers.forEach(b => talkingPoints.push(b.text));
  }
  if (enrichment.current_focus?.strategic_initiatives) {
    enrichment.current_focus.strategic_initiatives.forEach(b => talkingPoints.push(`Initiative: ${b.text}`));
  }
  sections.talkingPoints = talkingPoints;

  // Extract key insights from buying signals
  const insights: string[] = [];
  if (enrichment.buying_signals?.recent_news) {
    enrichment.buying_signals.recent_news.forEach(b => insights.push(b.text));
  }
  if (enrichment.buying_signals?.timing_triggers) {
    enrichment.buying_signals.timing_triggers.forEach(b => insights.push(`Timing: ${b.text}`));
  }
  if (enrichment.buying_signals?.hiring_signals) {
    enrichment.buying_signals.hiring_signals.forEach(b => insights.push(`Hiring: ${b.text}`));
  }
  sections.keyInsights = insights;

  return sections;
}

/**
 * Legacy parser for old enrichment format (quick enrich)
 */
function parseDeepProfile(markdown: string): ParsedProfile {
  const sections: ParsedProfile = {
    professionalProfile: '',
    companyProfile: '',
    painPoints: [],
    talkingPoints: [],
    keyInsights: [],
  };

  if (!markdown) return sections;

  // Extract major sections
  const professionalMatch = markdown.match(/## PROFESSIONAL PROFILE[^]*?(?=## COMPANY PROFILE|---|\n## |$)/);
  const companyMatch = markdown.match(/## COMPANY PROFILE[^]*?(?=## STRATEGIC|---|\n## |$)/);

  if (professionalMatch) sections.professionalProfile = professionalMatch[0].trim();
  if (companyMatch) sections.companyProfile = companyMatch[0].trim();

  // Extract lists
  const extractList = (sectionName: string): string[] => {
    const regex = new RegExp(`### ${sectionName}[^]*?(?=###|$)`, 'i');
    const match = markdown.match(regex);
    if (!match) return [];

    return match[0]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .map(line => line.replace(/^[-\d.]+\s*/, '').trim())
      .filter(Boolean);
  };

  sections.painPoints = extractList('Pain Points');
  sections.talkingPoints = extractList('Talking Points');
  sections.keyInsights = extractList('Key Insights');

  return sections;
}

export const ContactDetailModal: React.FC<Props> = ({
  contact: initialContact,
  onClose,
  onUpdate
}) => {
  const [contact, setContact] = useState<Contact>(initialContact);
  const [activeTab, setActiveTab] = useState<'info' | 'enrichment' | 'scoring' | 'deepprofile'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isDeepEnriching, setIsDeepEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [editData, setEditData] = useState<Partial<Contact>>(initialContact);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deep enrichment state
  const [deepProfile, setDeepProfile] = useState<string | null>(null);
  const [deepEnrichmentData, setDeepEnrichmentData] = useState<UnifiedEnrichmentResult | null>(null);
  const [parsedProfile, setParsedProfile] = useState<ParsedProfile | null>(null);
  const [lastDeepEnriched, setLastDeepEnriched] = useState<string | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);

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

  // QUICK FIX for ContactDetailModal.tsx
// Replace your handleDeepEnrich function with this improved version

const handleDeepEnrich = async () => {
  setIsDeepEnriching(true);
  setMessage(null);
  setEnrichmentProgress(0);
  
  try {
    // Get token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      setMessage({ type: 'error', text: 'Not authenticated. Please log in.' });
      setIsDeepEnriching(false);
      return;
    }

    // Trigger deep enrichment
    setMessage({ type: 'success', text: 'Starting deep enrichment... (takes 10-15 seconds)' });
    setEnrichmentProgress(10);
    
    const result = await deepEnrichContact(contact.id, token);
    console.log('✅ Deep enrichment triggered:', result);
    
    if (result.status === 'completed' || result.status === 'processing') {
      setEnrichmentProgress(30);
      
      // Poll for completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 * 2 seconds = 60 seconds max

      while (!completed && attempts < maxAttempts) {
        attempts++;
        setEnrichmentProgress(30 + (attempts / maxAttempts) * 60);
        
        try {
          const enrichedData = await getEnrichmentResult(contact.id, token);
          console.log(`✅ Poll attempt ${attempts}: Got response`, enrichedData);
          
          // Check if we have actual data
          if (enrichedData && enrichedData.contact_profile) {
            console.log('✅ Success! Got contact_profile');
            
            // Successfully got the deep enrichment data
            setDeepEnrichmentData(enrichedData as UnifiedEnrichmentResult);
            const parsed = transformDeepEnrichment(enrichedData as UnifiedEnrichmentResult);
            setParsedProfile(parsed);
            setDeepProfile(JSON.stringify(enrichedData, null, 2));
            setLastDeepEnriched(enrichedData.meta?.generated_at || new Date().toISOString());
            setMessage({ type: 'success', text: '✨ Deep enrichment complete!' });
            setActiveTab('deepprofile');
            setEnrichmentProgress(100);
            await refreshContact();
            onUpdate?.();
            completed = true;
            break;
          } else {
            // Got a response but no contact_profile yet
            console.log(`⏳ Poll attempt ${attempts}: Data not ready yet. Response:`, enrichedData);
          }
        } catch (err) {
          // Network error or parsing error
          console.log(`❌ Poll attempt ${attempts} error:`, err);
        }

        // Wait 2 seconds before next attempt
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!completed) {
        console.error('❌ Timed out after 30 attempts');
        setMessage({ 
          type: 'error', 
          text: 'Enrichment took longer than expected (60s timeout). Please check backend logs.' 
        });
      }
    } else if (result.error) {
      console.error('❌ Enrichment error from backend:', result.error);
      setMessage({ type: 'error', text: `Error: ${result.error}` });
    } else {
      console.warn('⚠️ Unexpected result status:', result.status);
      setMessage({ type: 'error', text: `Unexpected status: ${result.status}` });
    }
  } catch (err: any) {
    console.error('❌ Deep enrichment error:', err);
    setMessage({ type: 'error', text: err.message || 'Deep enrichment failed' });
  } finally {
    setIsDeepEnriching(false);
    setTimeout(() => setMessage(null), 5000);
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

  const renderMarkdown = (text: string) => {
    if (!text) return null;

    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h2 key={i} className="profile-h2">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={i} className="profile-h3">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="profile-li">{line.replace('- ', '')}</li>;
      }
      if (line.trim() === '') {
        return null;
      }
      return <p key={i} className="profile-p">{line}</p>;
    });
  };

  /**
   * Render deep enrichment data using new UnifiedEnrichmentResult schema
   */
  const renderDeepEnrichmentSections = () => {
    if (!deepEnrichmentData) return null;

    const { contact_profile, company_profile, current_focus, buying_signals, risks_and_objections, messaging } = deepEnrichmentData;

    return (
      <div className="deep-enrichment-sections">
        {/* Contact Profile Section */}
        <div className="enrichment-card contact-profile-card">
          <div className="card-header">
            <h4>👤 Contact Profile</h4>
          </div>
          <div className="card-body">
            {contact_profile.headline && (
              <p className="headline">{contact_profile.headline}</p>
            )}
            {contact_profile.role_summary && (
              <p className="role-summary">{contact_profile.role_summary}</p>
            )}
            {contact_profile.seniority && (
              <p className="seniority">
                <strong>Seniority:</strong> {contact_profile.seniority}
              </p>
            )}
            {contact_profile.background_bullets && contact_profile.background_bullets.length > 0 && (
              <div className="bullets-section">
                <h5>Background</h5>
                <ul>
                  {contact_profile.background_bullets.map((bullet, i) => (
                    <li key={i}>
                      {bullet.text}
                      {bullet.evidence && <span className="evidence"> ({bullet.evidence})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Company Profile Section */}
        <div className="enrichment-card company-profile-card">
          <div className="card-header">
            <h4>🏢 Company Profile</h4>
          </div>
          <div className="card-body">
            {company_profile.one_liner && (
              <p className="one-liner italic">{company_profile.one_liner}</p>
            )}
            <div className="company-meta">
              {company_profile.industry && <span><strong>Industry:</strong> {company_profile.industry}</span>}
              {company_profile.size_segment && <span><strong>Size:</strong> {company_profile.size_segment}</span>}
              {company_profile.region && <span><strong>Region:</strong> {company_profile.region}</span>}
            </div>
            {company_profile.key_products_or_services && company_profile.key_products_or_services.length > 0 && (
              <div className="bullets-section">
                <h5>Key Products/Services</h5>
                <ul>
                  {company_profile.key_products_or_services.map((product, i) => (
                    <li key={i}>{product.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Current Focus Section */}
        <div className="enrichment-card current-focus-card">
          <div className="card-header">
            <h4>🎯 Current Focus</h4>
          </div>
          <div className="card-body">
            {current_focus.strategic_initiatives && current_focus.strategic_initiatives.length > 0 && (
              <div className="focus-subsection">
                <h5>Strategic Initiatives</h5>
                <ul>
                  {current_focus.strategic_initiatives.map((init, i) => (
                    <li key={i}>{init.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {current_focus.recent_projects && current_focus.recent_projects.length > 0 && (
              <div className="focus-subsection">
                <h5>Recent Projects</h5>
                <ul>
                  {current_focus.recent_projects.map((proj, i) => (
                    <li key={i}>{proj.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {current_focus.primary_kpis && current_focus.primary_kpis.length > 0 && (
              <div className="focus-subsection">
                <h5>Primary KPIs</h5>
                <ul>
                  {current_focus.primary_kpis.map((kpi, i) => (
                    <li key={i}>{kpi.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Buying Signals Section */}
        <div className="enrichment-card buying-signals-card signal-card">
          <div className="card-header">
            <h4>⚡ Buying Signals</h4>
          </div>
          <div className="card-body">
            {buying_signals.recent_news && buying_signals.recent_news.length > 0 && (
              <div className="signal-subsection">
                <h5>Recent News</h5>
                <ul>
                  {buying_signals.recent_news.map((news, i) => (
                    <li key={i}>{news.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {buying_signals.timing_triggers && buying_signals.timing_triggers.length > 0 && (
              <div className="signal-subsection">
                <h5>Timing Triggers</h5>
                <ul>
                  {buying_signals.timing_triggers.map((trigger, i) => (
                    <li key={i}>{trigger.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {buying_signals.hiring_signals && buying_signals.hiring_signals.length > 0 && (
              <div className="signal-subsection">
                <h5>Hiring Signals</h5>
                <ul>
                  {buying_signals.hiring_signals.map((hire, i) => (
                    <li key={i}>{hire.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {buying_signals.tech_changes && buying_signals.tech_changes.length > 0 && (
              <div className="signal-subsection">
                <h5>Tech Changes</h5>
                <ul>
                  {buying_signals.tech_changes.map((tech, i) => (
                    <li key={i}>{tech.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Risks & Objections Section */}
        <div className="enrichment-card risks-card">
          <div className="card-header">
            <h4>⚠️ Risks & Objections</h4>
          </div>
          <div className="card-body">
            {risks_and_objections.risk_bullets && risks_and_objections.risk_bullets.length > 0 && (
              <div className="risk-subsection">
                <h5>Risk Bullets</h5>
                <ul>
                  {risks_and_objections.risk_bullets.map((risk, i) => (
                    <li key={i}>{risk.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {risks_and_objections.likely_objections && risks_and_objections.likely_objections.length > 0 && (
              <div className="risk-subsection">
                <h5>Likely Objections</h5>
                <ul>
                  {risks_and_objections.likely_objections.map((obj, i) => (
                    <li key={i}>{obj.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {risks_and_objections.landmines && risks_and_objections.landmines.length > 0 && (
              <div className="risk-subsection">
                <h5>Landmines</h5>
                <ul>
                  {risks_and_objections.landmines.map((landmine, i) => (
                    <li key={i}>{landmine.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Messaging Section */}
        <div className="enrichment-card messaging-card">
          <div className="card-header">
            <h4>💬 Messaging</h4>
          </div>
          <div className="card-body">
            {messaging.cold_openers && messaging.cold_openers.length > 0 && (
              <div className="messaging-subsection">
                <h5>Cold Openers</h5>
                <ul>
                  {messaging.cold_openers.map((opener, i) => (
                    <li key={i}>"{opener.text}"</li>
                  ))}
                </ul>
              </div>
            )}
            {messaging.value_props && messaging.value_props.length > 0 && (
              <div className="messaging-subsection">
                <h5>Value Propositions</h5>
                <ul>
                  {messaging.value_props.map((prop, i) => (
                    <li key={i}>{prop.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {messaging.call_to_action_ideas && messaging.call_to_action_ideas.length > 0 && (
              <div className="messaging-subsection">
                <h5>Call-to-Action Ideas</h5>
                <ul>
                  {messaging.call_to_action_ideas.map((cta, i) => (
                    <li key={i}>{cta.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        {deepEnrichmentData.meta && (
          <div className="enrichment-meta">
            <span>Generated: {deepEnrichmentData.meta.generated_at ? new Date(deepEnrichmentData.meta.generated_at).toLocaleString() : 'N/A'}</span>
            <span>Source: {deepEnrichmentData.meta.source || 'N/A'}</span>
            {deepEnrichmentData.meta.model && <span>Model: {deepEnrichmentData.meta.model}</span>}
            {deepEnrichmentData.meta.provider && <span>Provider: {deepEnrichmentData.meta.provider}</span>}
          </div>
        )}
      </div>
    );
  };

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

        {/* Progress Bar for Deep Enrichment */}
        {isDeepEnriching && enrichmentProgress > 0 && (
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${enrichmentProgress}%` }}></div>
            <span className="progress-text">{Math.round(enrichmentProgress)}%</span>
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
                {isEnriching ? 'Enriching...' : 'Quick'}
              </button>
              <button
                className={`btn-action btn-deep-enrich ${deepEnrichmentData ? 'has-profile' : ''}`}
                onClick={handleDeepEnrich}
                disabled={isDeepEnriching}
                title={deepEnrichmentData ? `Last enriched: ${lastDeepEnriched ? new Date(lastDeepEnriched).toLocaleDateString() : 'Unknown'}` : 'Generate deep profile'}
              >
                <Brain size={18} className={isDeepEnriching ? 'spin' : ''} />
                {isDeepEnriching ? 'Deep Enriching...' : deepEnrichmentData ? 'Re-Enrich' : 'Deep Enrich'}
              </button>
              <button className="btn-action btn-score" onClick={handleScore} disabled={isScoring}>
                <RefreshCw size={18} className={isScoring ? 'spin' : ''} />
                {isScoring ? 'Scoring...' : 'Score'}
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
            Quick Enrich {contact.enrichment_status === 'completed' && '✓'}
          </button>
          <button
            className={`tab-btn ${activeTab === 'deepprofile' ? 'active' : ''}`}
            onClick={() => setActiveTab('deepprofile')}
          >
            <Brain size={14} /> Deep Profile {deepEnrichmentData && '✓'}
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

          {/* DEEP PROFILE TAB */}
          {activeTab === 'deepprofile' && (
            <div className="tab-pane deep-profile-tab">
              {isDeepEnriching && (
                <div className="deep-enrich-loading">
                  <Brain size={48} className="spin" />
                  <h3>Deep Enriching...</h3>
                  <p>Analyzing contact with Perplexity AI</p>
                  <p className="loading-note">This takes 10-15 seconds</p>
                </div>
              )}

              {!isDeepEnriching && deepEnrichmentData ? (
                <div className="deep-profile-content">
                  {lastDeepEnriched && (
                    <div className="last-enriched-banner">
                      <CheckCircle size={14} />
                      Last enriched: {new Date(lastDeepEnriched).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}

                  {/* NEW: Display using UnifiedEnrichmentResult schema */}
                  {renderDeepEnrichmentSections()}

                  {/* LEGACY: Fallback for parsed profile (if using old format) */}
                  {parsedProfile && !deepEnrichmentData && (
                    <div className="intel-cards">
                      <div className="intel-card pain-points">
                        <div className="intel-card-header">
                          <AlertCircle size={20} />
                          <h4>Pain Points</h4>
                        </div>
                        <ul>
                          {parsedProfile.painPoints.length > 0 ? (
                            parsedProfile.painPoints.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))
                          ) : (
                            <li className="empty">Run deep enrich to identify pain points</li>
                          )}
                        </ul>
                      </div>

                      <div className="intel-card talking-points">
                        <div className="intel-card-header">
                          <MessageSquare size={20} />
                          <h4>Talking Points</h4>
                        </div>
                        <ul>
                          {parsedProfile.talkingPoints.length > 0 ? (
                            parsedProfile.talkingPoints.map((point, i) => (
                              <li key={i}>{point}</li>
                            ))
                          ) : (
                            <li className="empty">Run deep enrich for conversation starters</li>
                          )}
                        </ul>
                      </div>

                      <div className="intel-card key-insights">
                        <div className="intel-card-header">
                          <Lightbulb size={20} />
                          <h4>Key Insights</h4>
                        </div>
                        <ul>
                          {parsedProfile.keyInsights.length > 0 ? (
                            parsedProfile.keyInsights.map((insight, i) => (
                              <li key={i}>{insight}</li>
                            ))
                          ) : (
                            <li className="empty">Run deep enrich for strategic insights</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ) : !isDeepEnriching && (
                <div className="empty-state">
                  <Brain size={48} />
                  <h3>No deep profile yet</h3>
                  <p>Deep enrich uses Perplexity AI for comprehensive research</p>
                  <button
                    className="btn-deep-enrich-large"
                    onClick={handleDeepEnrich}
                    disabled={isDeepEnriching}
                  >
                    <Brain size={20} />
                    Generate Deep Profile
                  </button>
                  <p className="time-note">Takes 10-15 seconds</p>
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
