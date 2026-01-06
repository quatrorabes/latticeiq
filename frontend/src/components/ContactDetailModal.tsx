import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Phone, Building2, Briefcase, Globe, Linkedin, Edit2, Save, 
  Sparkles, Trash2, ExternalLink, Target, DollarSign, Activity, Award, 
  RefreshCw, CheckCircle, Brain, AlertCircle, Send, Clock, Calendar
} from 'lucide-react';
import { Contact, updateContact, deleteContact, fetchContact } from '../api/contacts';
import { enrichContact, deepEnrichContact, getEnrichmentResult } from '../api/enrichment';
import { calculateScores } from '../api/scoring';
import { supabase } from '../lib/supabaseClient';
import { UnifiedEnrichmentResult } from '../types/enrichment';
import { OutreachTab } from './OutreachTab';
import { CadenceTab } from './CadenceTab';
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


function transformDeepEnrichment(enrichment: UnifiedEnrichmentResult): ParsedProfile {
  const sections: ParsedProfile = {
    professionalProfile: '',
    companyProfile: '',
    painPoints: [],
    talkingPoints: [],
    keyInsights: [],
  };

  if (enrichment.contact_profile) {
    const cp = enrichment.contact_profile;
    let profText = '';
    if (cp.headline) profText += cp.headline + '\n\n';
    if (cp.role_summary) profText += cp.role_summary + '\n\n';
    if (cp.seniority) profText += `Seniority: ${cp.seniority}\n\n`;
    if (Array.isArray(cp.background_bullets)) {
      cp.background_bullets.forEach((bullet: any) => {
        profText += `• ${bullet.text}\n`;
      });
    }
    sections.professionalProfile = profText;
  }

  if (enrichment.company_profile) {
    const company = enrichment.company_profile;
    let companyText = '';
    if (company.one_liner) companyText += company.one_liner + '\n\n';
    if (company.industry) companyText += `Industry: ${company.industry}\n`;
    if (company.size_segment) companyText += `Size: ${company.size_segment}\n`;
    if (company.region) companyText += `Region: ${company.region}\n\n`;
    if (Array.isArray(company.key_products_or_services)) {
      company.key_products_or_services.forEach((product: any) => {
        companyText += `• ${product.text}\n`;
      });
    }
    sections.companyProfile = companyText;
  }

  if (Array.isArray(enrichment.risks_and_objections?.risk_bullets)) {
    sections.painPoints = enrichment.risks_and_objections.risk_bullets.map((b: any) => b.text);
  }

  const talkingPoints: string[] = [];
  if (enrichment.messaging?.cold_openers) {
    enrichment.messaging.cold_openers.forEach((b: any) => talkingPoints.push(b.text));
  }
  if (enrichment.current_focus?.strategic_initiatives) {
    enrichment.current_focus.strategic_initiatives.forEach((b: any) => talkingPoints.push(`Initiative: ${b.text}`));
  }
  sections.talkingPoints = talkingPoints;

  const insights: string[] = [];
  if (enrichment.buying_signals?.recent_news) {
    enrichment.buying_signals.recent_news.forEach((b: any) => insights.push(b.text));
  }
  if (enrichment.buying_signals?.timing_triggers) {
    enrichment.buying_signals.timing_triggers.forEach((b: any) => insights.push(`Timing: ${b.text}`));
  }
  if (enrichment.buying_signals?.hiring_signals) {
    enrichment.buying_signals.hiring_signals.forEach((b: any) => insights.push(`Hiring: ${b.text}`));
  }
  sections.keyInsights = insights;

  return sections;
}


/**
 * Extract deep enrichment data from contact's enrichment_data field
 */
function extractDeepEnrichmentFromContact(contact: Contact): UnifiedEnrichmentResult | null {
  if (!contact.enrichment_data) return null;
  
  const ed = contact.enrichment_data as any;
  
  // Try multiple extraction patterns
  if (ed.data?.contact_profile) {
    return ed.data as UnifiedEnrichmentResult;
  }
  if (ed.contact_profile) {
    return ed as UnifiedEnrichmentResult;
  }
  
  return null;
}


export const ContactDetailModal: React.FC<Props> = ({ contact: initialContact, onClose, onUpdate }) => {
  const [contact, setContact] = useState<Contact>(initialContact);
  const [activeTab, setActiveTab] = useState<'info' | 'enrichment' | 'scoring' | 'deepprofile' | 'outreach' | 'cadence'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isDeepEnriching, setIsDeepEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [editData, setEditData] = useState<Partial<Contact>>(initialContact);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Deep enrichment state
  const [deepEnrichmentData, setDeepEnrichmentData] = useState<UnifiedEnrichmentResult | null>(null);
  const [lastDeepEnriched, setLastDeepEnriched] = useState<string | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);

  // ✅ Load existing deep enrichment on mount
  useEffect(() => {
    setContact(initialContact);
    setEditData(initialContact);
    
    // Extract and load existing deep enrichment data
    const existingData = extractDeepEnrichmentFromContact(initialContact);
    if (existingData) {
      console.log('✅ Loaded existing deep enrichment from contact:', existingData);
      setDeepEnrichmentData(existingData);
      setLastDeepEnriched(existingData.meta?.generated_at || null);
      // Auto-switch to deep profile tab if data exists
      setActiveTab('deepprofile');
    } else if (initialContact.enrichment_status === 'completed') {
      setActiveTab('scoring');
    }
  }, [initialContact]);

  // Switch to deepprofile tab when data is populated
  useEffect(() => {
    if (deepEnrichmentData && Object.keys(deepEnrichmentData).length > 0 && !isDeepEnriching) {
      setActiveTab('deepprofile');
    }
  }, [deepEnrichmentData, isDeepEnriching]);

  const refreshContact = async () => {
    try {
      const fresh = await fetchContact(contact.id);
      setContact(fresh);
      setEditData(fresh);
      
      // Also refresh deep enrichment data
      const existingData = extractDeepEnrichmentFromContact(fresh);
      if (existingData) {
        setDeepEnrichmentData(existingData);
        setLastDeepEnriched(existingData.meta?.generated_at || null);
      }
    } catch (err) {
      console.error('Failed to refresh contact:', err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await updateContact(contact.id, editData);
      await refreshContact();
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Contact saved!' });
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
      setMessage({ type: 'success', text: 'Quick enrichment complete!' });
      onUpdate?.();
      setActiveTab('scoring');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Enrichment failed' });
    } finally {
      setIsEnriching(false);
    }
  };

  // ✅ FIXED: handleDeepEnrich with cost protection
  const handleDeepEnrich = async () => {
    // ⚠️ COST PROTECTION: Confirm if already enriched
    if (deepEnrichmentData) {
      const lastDate = lastDeepEnriched ? new Date(lastDeepEnriched).toLocaleDateString() : 'previously';
      const confirmed = confirm(
        `⚠️ This contact was already deep enriched on ${lastDate}.\n\n` +
        `Re-enriching will cost additional API credits.\n\n` +
        `Are you sure you want to re-enrich?`
      );
      if (!confirmed) return;
    }

    setIsDeepEnriching(true);
    setMessage(null);
    setEnrichmentProgress(0);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setMessage({ type: 'error', text: 'Not authenticated. Please log in.' });
        setIsDeepEnriching(false);
        return;
      }

      setMessage({ type: 'success', text: 'Starting deep enrichment... (10-15 seconds)' });
      setEnrichmentProgress(10);
      
      const result = await deepEnrichContact(contact.id, token);
      console.log('✅ Deep enrichment triggered:', result);
      
      if (result.status === 'completed' || result.status === 'processing') {
        setEnrichmentProgress(30);
        
        let completed = false;
        let attempts = 0;
        const maxAttempts = 30;

        while (!completed && attempts < maxAttempts) {
          attempts++;
          setEnrichmentProgress(30 + (attempts / maxAttempts) * 60);
          
          try {
            const response = await getEnrichmentResult(contact.id, token);
            
            let actualData = null;
            if (response?.enrichment_data?.data) {
              actualData = response.enrichment_data.data;
            } else if (response?.enrichment_data) {
              actualData = response.enrichment_data;
            } else if (response?.contact_profile) {
              actualData = response;
            }
            
            if (actualData && 
                Object.keys(actualData).length > 0 && 
                actualData.contact_profile &&
                Object.keys(actualData.contact_profile).length > 0) {
              
              console.log('✅ SUCCESS! Data ready:', actualData);
              
              setDeepEnrichmentData(actualData as UnifiedEnrichmentResult);
              setLastDeepEnriched(actualData.meta?.generated_at || new Date().toISOString());
              setMessage({ type: 'success', text: '✨ Deep enrichment complete!' });
              
              await refreshContact();
              onUpdate?.();
              completed = true;
              setEnrichmentProgress(100);
              break;
            }
          } catch (err) {
            console.log(`⚠️ Poll attempt ${attempts} error:`, err);
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!completed) {
          setMessage({ type: 'error', text: 'Enrichment timed out. Please try again.' });
        }
      } else if (result.error) {
        setMessage({ type: 'error', text: `Error: ${result.error}` });
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

  const getTierColor = (tier?: string) => {
    if (!tier) return '#6b7280';
    switch (tier.toLowerCase()) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const renderDeepEnrichmentSections = () => {
    if (!deepEnrichmentData) return null;
    
    const contact_profile = deepEnrichmentData.contact_profile || {};
    const company_profile = deepEnrichmentData.company_profile || {};
    const current_focus = deepEnrichmentData.current_focus || {};
    const buying_signals = deepEnrichmentData.buying_signals || {};
    const risks_and_objections = deepEnrichmentData.risks_and_objections || {};
    const messaging = deepEnrichmentData.messaging || {};

    const hasAnyData = 
      Object.keys(contact_profile).length > 0 ||
      Object.keys(company_profile).length > 0 ||
      Object.keys(current_focus).length > 0 ||
      Object.keys(buying_signals).length > 0 ||
      Object.keys(risks_and_objections).length > 0 ||
      Object.keys(messaging).length > 0;

    if (!hasAnyData) {
      return <div className="empty-state"><p>No enrichment data available</p></div>;
    }

    return (
      <div className="deep-enrichment-sections">
        {/* Contact Profile */}
        {Object.keys(contact_profile).length > 0 && (
          <div className="enrichment-card">
            <div className="card-header"><h4>👤 Contact Profile</h4></div>
            <div className="card-body">
              {contact_profile.headline && <p className="headline"><strong>{contact_profile.headline}</strong></p>}
              {contact_profile.role_summary && <p className="role-summary">{contact_profile.role_summary}</p>}
              {contact_profile.seniority && <p><strong>Seniority:</strong> {contact_profile.seniority}</p>}
              {contact_profile.background_bullets?.length > 0 && (
                <div className="bullets-section">
                  <h5>Background</h5>
                  <ul>{contact_profile.background_bullets.map((b: any, i: number) => <li key={i}>{b.text}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Company Profile */}
        {Object.keys(company_profile).length > 0 && (
          <div className="enrichment-card">
            <div className="card-header"><h4>🏢 Company Profile</h4></div>
            <div className="card-body">
              {company_profile.one_liner && <p className="italic">{company_profile.one_liner}</p>}
              <div className="company-meta">
                {company_profile.industry && <span><strong>Industry:</strong> {company_profile.industry}</span>}
                {company_profile.size_segment && <span><strong>Size:</strong> {company_profile.size_segment}</span>}
                {company_profile.region && <span><strong>Region:</strong> {company_profile.region}</span>}
              </div>
              {company_profile.key_products_or_services?.length > 0 && (
                <div className="bullets-section">
                  <h5>Products/Services</h5>
                  <ul>{company_profile.key_products_or_services.map((p: any, i: number) => <li key={i}>{p.text}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Current Focus */}
        {Object.keys(current_focus).length > 0 && (
          <div className="enrichment-card">
            <div className="card-header"><h4>🎯 Current Focus</h4></div>
            <div className="card-body">
              {current_focus.strategic_initiatives?.length > 0 && (
                <div className="subsection"><h5>Strategic Initiatives</h5><ul>{current_focus.strategic_initiatives.map((i: any, idx: number) => <li key={idx}>{i.text}</li>)}</ul></div>
              )}
              {current_focus.recent_projects?.length > 0 && (
                <div className="subsection"><h5>Recent Projects</h5><ul>{current_focus.recent_projects.map((p: any, idx: number) => <li key={idx}>{p.text}</li>)}</ul></div>
              )}
              {current_focus.primary_kpis?.length > 0 && (
                <div className="subsection"><h5>Primary KPIs</h5><ul>{current_focus.primary_kpis.map((k: any, idx: number) => <li key={idx}>{k.text}</li>)}</ul></div>
              )}
            </div>
          </div>
        )}

        {/* Buying Signals */}
        {Object.keys(buying_signals).length > 0 && (
          <div className="enrichment-card signal-card">
            <div className="card-header"><h4>🚀 Buying Signals</h4></div>
            <div className="card-body">
              {buying_signals.recent_news?.length > 0 && (
                <div className="subsection"><h5>Recent News</h5><ul>{buying_signals.recent_news.map((n: any, i: number) => <li key={i}>{n.text}</li>)}</ul></div>
              )}
              {buying_signals.timing_triggers?.length > 0 && (
                <div className="subsection"><h5>Timing Triggers</h5><ul>{buying_signals.timing_triggers.map((t: any, i: number) => <li key={i}>{t.text}</li>)}</ul></div>
              )}
              {buying_signals.hiring_signals?.length > 0 && (
                <div className="subsection"><h5>Hiring Signals</h5><ul>{buying_signals.hiring_signals.map((h: any, i: number) => <li key={i}>{h.text}</li>)}</ul></div>
              )}
              {buying_signals.tech_changes?.length > 0 && (
                <div className="subsection"><h5>Tech Changes</h5><ul>{buying_signals.tech_changes.map((t: any, i: number) => <li key={i}>{t.text}</li>)}</ul></div>
              )}
            </div>
          </div>
        )}

        {/* Risks & Objections */}
        {Object.keys(risks_and_objections).length > 0 && (
          <div className="enrichment-card risks-card">
            <div className="card-header"><h4>⚠️ Risks & Objections</h4></div>
            <div className="card-body">
              {risks_and_objections.risk_bullets?.length > 0 && (
                <div className="subsection"><h5>Risk Factors</h5><ul>{risks_and_objections.risk_bullets.map((r: any, i: number) => <li key={i}>{r.text}</li>)}</ul></div>
              )}
              {risks_and_objections.likely_objections?.length > 0 && (
                <div className="subsection"><h5>Likely Objections</h5><ul>{risks_and_objections.likely_objections.map((o: any, i: number) => <li key={i}>{o.text}</li>)}</ul></div>
              )}
              {risks_and_objections.landmines?.length > 0 && (
                <div className="subsection"><h5>Landmines</h5><ul>{risks_and_objections.landmines.map((l: any, i: number) => <li key={i}>{l.text}</li>)}</ul></div>
              )}
            </div>
          </div>
        )}

        {/* Messaging */}
        {Object.keys(messaging).length > 0 && (
          <div className="enrichment-card">
            <div className="card-header"><h4>💬 Messaging</h4></div>
            <div className="card-body">
              {messaging.cold_openers?.length > 0 && (
                <div className="subsection"><h5>Cold Openers</h5><ul>{messaging.cold_openers.map((o: any, i: number) => <li key={i}>{o.text}</li>)}</ul></div>
              )}
              {messaging.value_props?.length > 0 && (
                <div className="subsection"><h5>Value Props</h5><ul>{messaging.value_props.map((v: any, i: number) => <li key={i}>{v.text}</li>)}</ul></div>
              )}
              {messaging.call_to_action_ideas?.length > 0 && (
                <div className="subsection"><h5>CTA Ideas</h5><ul>{messaging.call_to_action_ideas.map((c: any, i: number) => <li key={i}>{c.text}</li>)}</ul></div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        {deepEnrichmentData.meta && (
          <div className="enrichment-meta">
            <Clock size={14} />
            <span>Generated: {deepEnrichmentData.meta.generated_at ? new Date(deepEnrichmentData.meta.generated_at).toLocaleString() : 'N/A'}</span>
            {deepEnrichmentData.meta.model && <span>• {deepEnrichmentData.meta.model}</span>}
          </div>
        )}
      </div>
    );
  };

  const outreachContact = {
    id: contact.id,
    firstname: contact.first_name || '',
    lastname: contact.last_name || '',
    email: contact.email || '',
    company: contact.company,
    title: contact.title
  };

  // Check enrichment status for button states
  const hasQuickEnrich = contact.enrichment_status === 'completed';
  const hasDeepEnrich = !!deepEnrichmentData;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <div className="avatar-large">
              {contact.first_name?.charAt(0)}{contact.last_name?.charAt(0)}
            </div>
            <div className="header-info">
              {isEditing ? (
                <div className="edit-name-row">
                  <input type="text" value={editData.first_name} onChange={e => setEditData({...editData, first_name: e.target.value})} placeholder="First" className="input-name" />
                  <input type="text" value={editData.last_name} onChange={e => setEditData({...editData, last_name: e.target.value})} placeholder="Last" className="input-name" />
                </div>
              ) : (
                <>
                  <h2>{contact.first_name} {contact.last_name}</h2>
                  <p className="header-subtitle">{contact.title || 'No title'} @ {contact.company || 'Unknown'}</p>
                </>
              )}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`message-banner ${message.type}`}>
            {message.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
            {message.text}
          </div>
        )}

        {/* Progress Bar */}
        {isDeepEnriching && (
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${enrichmentProgress}%` }} />
            <span className="progress-text">{Math.round(enrichmentProgress)}%</span>
          </div>
        )}

        {/* ✅ REORGANIZED Action Buttons - Compact Row */}
        <div className="modal-actions compact">
          {isEditing ? (
            <>
              <button className="btn-sm btn-save" onClick={handleSave} disabled={isSaving}>
                <Save size={14} /> {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-sm" onClick={() => { setIsEditing(false); setEditData(contact); }}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn-sm" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</button>
              
              <button 
                className={`btn-sm btn-enrich ${hasQuickEnrich ? 'completed' : ''}`} 
                onClick={handleEnrich} 
                disabled={isEnriching}
                title={hasQuickEnrich ? 'Already enriched' : 'Run quick enrichment'}
              >
                <Sparkles size={14} className={isEnriching ? 'spin' : ''} />
                {hasQuickEnrich ? 'Enriched ✓' : isEnriching ? 'Running...' : 'Quick Enrich'}
              </button>
              
              <button 
                className={`btn-sm btn-deep ${hasDeepEnrich ? 'completed' : ''}`} 
                onClick={handleDeepEnrich} 
                disabled={isDeepEnriching}
                title={hasDeepEnrich ? `Enriched ${lastDeepEnriched ? new Date(lastDeepEnriched).toLocaleDateString() : ''} - Click to re-enrich (costs credits)` : 'Run deep enrichment (~$0.02)'}
              >
                <Brain size={14} className={isDeepEnriching ? 'spin' : ''} />
                {hasDeepEnrich ? 'Deep ✓' : isDeepEnriching ? 'Running...' : 'Deep Enrich'}
              </button>
              
              <button className="btn-sm btn-score" onClick={handleScore} disabled={isScoring}>
                <RefreshCw size={14} className={isScoring ? 'spin' : ''} />
                {isScoring ? 'Scoring...' : 'Rescore'}
              </button>
              
              <button className="btn-sm btn-delete" onClick={handleDelete}><Trash2 size={14} /></button>
            </>
          )}
        </div>

        {/* ✅ UPDATED Tabs - Now includes Cadence */}
        <div className="modal-tabs">
          <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>Info</button>
          <button className={`tab-btn ${activeTab === 'enrichment' ? 'active' : ''}`} onClick={() => setActiveTab('enrichment')}>
            Quick {hasQuickEnrich && '✓'}
          </button>
          <button className={`tab-btn ${activeTab === 'deepprofile' ? 'active' : ''}`} onClick={() => setActiveTab('deepprofile')}>
            <Brain size={12} /> Deep {hasDeepEnrich && '✨'}
          </button>
          <button className={`tab-btn ${activeTab === 'scoring' ? 'active' : ''}`} onClick={() => setActiveTab('scoring')}>
            Score {contact.overall_score && `(${contact.overall_score})`}
          </button>
          <button className={`tab-btn ${activeTab === 'outreach' ? 'active' : ''}`} onClick={() => setActiveTab('outreach')}>
            <Send size={12} /> Outreach
          </button>
          <button className={`tab-btn ${activeTab === 'cadence' ? 'active' : ''}`} onClick={() => setActiveTab('cadence')}>
            <Calendar size={12} /> Cadence
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-body">
          {activeTab === 'info' && (
            <div className="tab-pane">
              <div className="info-grid compact">
                <div className="info-field">
                  <label><Mail size={14}/> Email</label>
                  {isEditing ? (
                    <input type="email" value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} className="input-field" />
                  ) : (
                    <a href={`mailto:${contact.email}`} className="info-value link">{contact.email}</a>
                  )}
                </div>
                <div className="info-field">
                  <label><Phone size={14}/> Phone</label>
                  {isEditing ? (
                    <input type="text" value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} className="input-field" />
                  ) : (
                    <span className="info-value">{contact.phone || '—'}</span>
                  )}
                </div>
                <div className="info-field">
                  <label><Linkedin size={14}/> LinkedIn</label>
                  {isEditing ? (
                    <input type="text" value={editData.linkedin_url || ''} onChange={e => setEditData({...editData, linkedin_url: e.target.value})} className="input-field" />
                  ) : (
                    <a href={contact.linkedin_url || '#'} target="_blank" rel="noreferrer" className="info-value link">
                      {contact.linkedin_url ? 'View' : '—'} {contact.linkedin_url && <ExternalLink size={10}/>}
                    </a>
                  )}
                </div>
                <div className="info-field">
                  <label><Building2 size={14}/> Company</label>
                  {isEditing ? (
                    <input type="text" value={editData.company || ''} onChange={e => setEditData({...editData, company: e.target.value})} className="input-field" />
                  ) : (
                    <span className="info-value">{contact.company || '—'}</span>
                  )}
                </div>
                <div className="info-field">
                  <label><Briefcase size={14}/> Title</label>
                  {isEditing ? (
                    <input type="text" value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="input-field" />
                  ) : (
                    <span className="info-value">{contact.title || '—'}</span>
                  )}
                </div>
                <div className="info-field">
                  <label><Globe size={14}/> Website</label>
                  {isEditing ? (
                    <input type="text" value={editData.website || ''} onChange={e => setEditData({...editData, website: e.target.value})} className="input-field" />
                  ) : (
                    <a href={contact.website || '#'} target="_blank" rel="noreferrer" className="info-value link">{contact.website || '—'}</a>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="tab-pane">
              {hasQuickEnrich ? (
                <div className="enrichment-results">
                  <CheckCircle size={24} className="success-icon" />
                  <p>Quick enrichment completed. View scores in the Scoring tab or run Deep Enrich for detailed research.</p>
                </div>
              ) : (
                <div className="empty-state">
                  <Sparkles size={40} className="empty-icon" />
                  <h3>No enrichment yet</h3>
                  <p>Run quick enrich for basic firmographics.</p>
                  <button className="btn-generate" onClick={handleEnrich} disabled={isEnriching}>
                    {isEnriching ? 'Running...' : 'Quick Enrich'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deepprofile' && (
            <div className="tab-pane">
              {hasDeepEnrich ? (
                renderDeepEnrichmentSections()
              ) : (
                <div className="empty-state">
                  <Brain size={40} className="empty-icon" />
                  <h3>No deep profile yet</h3>
                  <p>Deep enrich uses Perplexity AI (10-15 sec, ~$0.02)</p>
                  <button className="btn-generate" onClick={handleDeepEnrich} disabled={isDeepEnriching}>
                    {isDeepEnriching ? 'Researching...' : 'Generate Deep Profile'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ✅ REDESIGNED SCORING TAB */}
          {activeTab === 'scoring' && (
            <div className="tab-pane scoring-redesign">
              {/* Hero Score with Visual Gauge */}
              <div className="score-hero">
                <div className="score-gauge">
                  <svg viewBox="0 0 120 120" className="gauge-ring">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="12" />
                    <circle 
                      cx="60" cy="60" r="54" fill="none" 
                      stroke={getTierColor(contact.overall_tier)} 
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${(contact.overall_score || 0) * 3.39} 339`}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div className="gauge-center">
                    <span className="gauge-score">{contact.overall_score || '--'}</span>
                    <span className="gauge-tier" style={{ color: getTierColor(contact.overall_tier) }}>
                      {contact.overall_tier?.toUpperCase() || 'UNSCORED'}
                    </span>
                  </div>
                </div>
                <div className="score-hero-text">
                  <h3>Lead Quality Score</h3>
                  <p className="score-summary">
                    {contact.overall_tier === 'hot' && '🔥 High-priority lead. Ready for immediate outreach.'}
                    {contact.overall_tier === 'warm' && '👍 Good prospect. Consider nurturing with targeted content.'}
                    {contact.overall_tier === 'cold' && '❄️ Needs more qualification. May require warming up.'}
                    {!contact.overall_tier && 'Run enrichment to calculate lead score.'}
                  </p>
                </div>
              </div>

              {/* Framework Scores - Compact Row */}
              <div className="framework-scores">
                <div className="framework-card">
                  <div className="framework-header">
                    <Target size={16} style={{ color: getTierColor(contact.mdcp_tier) }} />
                    <span className="framework-name">MDCP</span>
                    <span className="framework-score" style={{ color: getTierColor(contact.mdcp_tier) }}>
                      {contact.mdcp_score || '--'}
                    </span>
                  </div>
                  <div className="framework-bar">
                    <div className="bar-fill" style={{ width: `${contact.mdcp_score || 0}%`, background: getTierColor(contact.mdcp_tier) }} />
                  </div>
                  <span className="framework-label">Market, Decision, Capability, Profile</span>
                </div>

                <div className="framework-card">
                  <div className="framework-header">
                    <DollarSign size={16} style={{ color: getTierColor(contact.bant_tier) }} />
                    <span className="framework-name">BANT</span>
                    <span className="framework-score" style={{ color: getTierColor(contact.bant_tier) }}>
                      {contact.bant_score || '--'}
                    </span>
                  </div>
                  <div className="framework-bar">
                    <div className="bar-fill" style={{ width: `${contact.bant_score || 0}%`, background: getTierColor(contact.bant_tier) }} />
                  </div>
                  <span className="framework-label">Budget, Authority, Need, Timeline</span>
                </div>

                <div className="framework-card">
                  <div className="framework-header">
                    <Activity size={16} style={{ color: getTierColor(contact.spice_tier) }} />
                    <span className="framework-name">SPICE</span>
                    <span className="framework-score" style={{ color: getTierColor(contact.spice_tier) }}>
                      {contact.spice_score || '--'}
                    </span>
                  </div>
                  <div className="framework-bar">
                    <div className="bar-fill" style={{ width: `${contact.spice_score || 0}%`, background: getTierColor(contact.spice_tier) }} />
                  </div>
                  <span className="framework-label">Situation, Pain, Impact, Critical Event</span>
                </div>
              </div>

              {/* Next Best Action */}
              <div className="next-action-card">
                <div className="action-header">
                  <Sparkles size={16} />
                  <span>Recommended Next Step</span>
                </div>
                <div className="action-content">
                  {contact.overall_tier === 'hot' && (
                    <>
                      <strong>📞 Call within 24 hours</strong>
                      <p>This lead shows strong buying signals. Check the Outreach tab for AI-generated call scripts.</p>
                    </>
                  )}
                  {contact.overall_tier === 'warm' && (
                    <>
                      <strong>✉️ Send personalized email</strong>
                      <p>Build rapport with value-driven content. Check Deep Profile for talking points.</p>
                    </>
                  )}
                  {contact.overall_tier === 'cold' && (
                    <>
                      <strong>🔍 Research & qualify further</strong>
                      <p>Run Deep Enrich to uncover pain points and timing triggers.</p>
                    </>
                  )}
                  {!contact.overall_tier && (
                    <>
                      <strong>⚡ Enrich this contact</strong>
                      <p>Run Quick Enrich to get firmographics and calculate lead scores.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'outreach' && (
            <div className="tab-pane">
              <OutreachTab contact={outreachContact} onUpdate={refreshContact} />
            </div>
          )}

          {/* ✅ NEW: CADENCE TAB */}
          {activeTab === 'cadence' && (
            <div className="tab-pane">
              <CadenceTab 
                contactId={contact.id}
                contactName={`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                onUpdate={refreshContact}
              />
            </div>
          )}
        </div>
      </div>

      {/* ✅ INLINE STYLES - UPDATED WITH SCORING REDESIGN */}
      <style>{`
        .modal-wide {
          max-width: 900px !important;
          width: 95vw !important;
        }
        
        .modal-actions.compact {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
        }
        
        .btn-sm {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: 6px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(30, 41, 59, 0.8);
          color: #e2e8f0;
          cursor: pointer;
          transition: all 0.15s;
        }
        
        .btn-sm:hover:not(:disabled) {
          background: rgba(51, 65, 85, 0.9);
          border-color: rgba(148, 163, 184, 0.4);
        }
        
        .btn-sm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .btn-sm.btn-enrich {
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          border-color: transparent;
          color: white;
        }
        
        .btn-sm.btn-enrich.completed {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.4);
          color: #22c55e;
        }
        
        .btn-sm.btn-deep {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-color: transparent;
          color: white;
        }
        
        .btn-sm.btn-deep.completed {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.4);
          color: #a5b4fc;
        }
        
        .btn-sm.btn-score {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }
        
        .btn-sm.btn-delete {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        
        .btn-sm.btn-save {
          background: #22c55e;
          border-color: #22c55e;
          color: white;
        }
        
        .modal-tabs {
          font-size: 0.85rem;
        }
        
        .tab-btn {
          padding: 0.6rem 1rem;
          font-size: 0.8rem;
        }
        
        .info-grid.compact {
          gap: 0.75rem;
        }
        
        .info-field label {
          font-size: 0.75rem;
        }
        
        .info-value {
          font-size: 0.85rem;
        }
        
        .enrichment-card {
          font-size: 0.85rem;
        }
        
        .enrichment-card h4 {
          font-size: 0.95rem;
        }
        
        .enrichment-card h5 {
          font-size: 0.8rem;
          margin: 0.5rem 0 0.25rem;
        }
        
        .enrichment-card li {
          font-size: 0.8rem;
          line-height: 1.4;
        }
        
        .enrichment-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .success-icon {
          color: #22c55e;
          margin-bottom: 0.5rem;
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ✅ NEW SCORING TAB STYLES */
        .scoring-redesign {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .score-hero {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.25rem;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .score-gauge {
          position: relative;
          width: 100px;
          height: 100px;
          flex-shrink: 0;
        }

        .gauge-ring {
          width: 100%;
          height: 100%;
        }

        .gauge-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .gauge-score {
          display: block;
          font-size: 1.75rem;
          font-weight: 800;
          color: #f8fafc;
          line-height: 1;
        }

        .gauge-tier {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .score-hero-text h3 {
          margin: 0 0 0.25rem;
          font-size: 1rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .score-summary {
          margin: 0;
          font-size: 0.85rem;
          color: #94a3b8;
          line-height: 1.4;
        }

        .framework-scores {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        .framework-card {
          padding: 0.875rem;
          background: rgba(30, 41, 59, 0.6);
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.1);
        }

        .framework-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .framework-name {
          font-weight: 700;
          font-size: 0.8rem;
          color: #e2e8f0;
          flex: 1;
        }

        .framework-score {
          font-weight: 800;
          font-size: 1.1rem;
        }

        .framework-bar {
          height: 4px;
          background: rgba(148, 163, 184, 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .framework-label {
          font-size: 0.65rem;
          color: #64748b;
          line-height: 1.2;
        }

        .next-action-card {
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          overflow: hidden;
        }

        .action-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1rem;
          background: rgba(99, 102, 241, 0.1);
          font-size: 0.75rem;
          font-weight: 600;
          color: #a5b4fc;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .action-content {
          padding: 0.875rem 1rem;
        }

        .action-content strong {
          display: block;
          font-size: 0.9rem;
          color: #f8fafc;
          margin-bottom: 0.25rem;
        }

        .action-content p {
          margin: 0;
          font-size: 0.8rem;
          color: #94a3b8;
        }

        /* Responsive: stack on mobile */
        @media (max-width: 640px) {
          .framework-scores {
            grid-template-columns: 1fr;
          }
          .score-hero {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};
