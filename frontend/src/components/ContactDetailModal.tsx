import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Phone, Building2, Briefcase, Globe, Linkedin, Edit2, Save, 
  Sparkles, Trash2, ExternalLink, Target, DollarSign, Activity, Award, 
  RefreshCw, CheckCircle, Brain, MessageSquare, Lightbulb, AlertCircle,
  Send
} from 'lucide-react';
import { Contact, updateContact, deleteContact, fetchContact } from '../api/contacts';
import { enrichContact, deepEnrichContact, getEnrichmentResult, pollEnrichmentComplete } from '../api/enrichment';
import { calculateScores } from '../api/scoring';
import { supabase } from '../lib/supabaseClient';
import { UnifiedEnrichmentResult, LegacyEnrichmentData } from '../types/enrichment';
import OutreachTab from '../components/OutreachTab';
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
 * FIXED: Uses snake_case keys to match backend
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
    let profText = 'PROFESSIONAL PROFILE:\n\n';
    if (cp.headline) profText += cp.headline + '\n\n';
    if (cp.role_summary) profText += cp.role_summary + '\n\n';
    if (cp.seniority) profText += `Seniority: ${cp.seniority}\n\n`;
    profText += 'Background:\n';
    if (Array.isArray(cp.background_bullets)) {
      cp.background_bullets.forEach((bullet: any) => {
        profText += `- ${bullet.text}\n`;
      });
    }
    sections.professionalProfile = profText;
  }



  // Company Profile section
  if (enrichment.company_profile) {
    const company = enrichment.company_profile;
    let companyText = 'COMPANY PROFILE:\n\n';
    if (company.one_liner) companyText += company.one_liner + '\n\n';
    if (company.industry) companyText += `Industry: ${company.industry}\n`;
    if (company.size_segment) companyText += `Size: ${company.size_segment}\n`;
    if (company.region) companyText += `Region: ${company.region}\n\n`;
    companyText += 'Key Products/Services:\n';
    if (Array.isArray(company.key_products_or_services)) {
      company.key_products_or_services.forEach((product: any) => {
        companyText += `- ${product.text}\n`;
      });
    }
    sections.companyProfile = companyText;
  }



  // Extract pain points from risks & objections
  if (Array.isArray(enrichment.risks_and_objections?.risk_bullets)) {
    sections.painPoints = enrichment.risks_and_objections.risk_bullets.map((b: any) => b.text);
  }



  // Extract talking points from messaging & current focus
  const talkingPoints: string[] = [];
  if (enrichment.messaging?.cold_openers) {
    enrichment.messaging.cold_openers.forEach((b: any) => talkingPoints.push(b.text));
  }
  if (enrichment.current_focus?.strategic_initiatives) {
    enrichment.current_focus.strategic_initiatives.forEach((b: any) => talkingPoints.push(`Initiative: ${b.text}`));
  }
  sections.talkingPoints = talkingPoints;



  // Extract key insights from buying signals
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



// Legacy parser for old enrichment format (quick enrich)
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
  const professionalMatch = markdown.match(/PROFESSIONAL PROFILE:?[\s\S]*?(?=COMPANY PROFILE|---)/i);
  const companyMatch = markdown.match(/COMPANY PROFILE:?[\s\S]*?(?=STRATEGIC|---)/i);



  if (professionalMatch) sections.professionalProfile = professionalMatch[0].trim();
  if (companyMatch) sections.companyProfile = companyMatch[0].trim();



  // Extract lists
  const extractList = (sectionName: string): string[] => {
    const regex = new RegExp(`${sectionName}:?[\\s\S]*?(?=\\n\\n|\\n###|---)`, 'i');
    const match = markdown.match(regex);
    if (!match) return [];
    
    return match[0]
      .split('\n')
      .filter((line: string) => line.trim().startsWith('-') || line.trim().match(/^\d\./))
      .map((line: string) => line.replace(/^[- \d\.]+/, '').trim())
      .filter(Boolean);
  };



  sections.painPoints = extractList('Pain Points');
  sections.talkingPoints = extractList('Talking Points');
  sections.keyInsights = extractList('Key Insights');



  return sections;
}



export const ContactDetailModal: React.FC<Props> = ({ contact: initialContact, onClose, onUpdate }) => {
  const [contact, setContact] = useState<Contact>(initialContact);
  const [activeTab, setActiveTab] = useState<'info' | 'enrichment' | 'scoring' | 'deepprofile' | 'outreach'>(initialContact.enrichment_data ? 'deepprofile' : 'info');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isDeepEnriching, setIsDeepEnriching] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [editData, setEditData] = useState<Partial<Contact>>(initialContact);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);



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



  // ✅ NEW: useEffect to switch tabs when deepEnrichmentData is populated
  useEffect(() => {
    if (deepEnrichmentData && Object.keys(deepEnrichmentData).length > 0 && !isDeepEnriching) {
      console.log('✅ Deep enrichment data populated, switching to deepprofile tab');
      setActiveTab('deepprofile');
    }
  }, [deepEnrichmentData, isDeepEnriching]);



  const refreshContact = async () => {
    try {
      const fresh = await fetchContact(contact.id);
      setContact(fresh);
      setEditData(fresh);
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



  // ✅ COMPLETELY FIXED: handleDeepEnrich with proper state management and useEffect
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
        const maxAttempts = 30;


        while (!completed && attempts < maxAttempts) {
          attempts++;
          setEnrichmentProgress(30 + (attempts / maxAttempts) * 60);
          
          try {
            const response = await getEnrichmentResult(contact.id, token);
            console.log(`🔍 Poll attempt ${attempts}:`, response);
            
            // 🔧 CRITICAL FIX: Extract data from correct structure
            let actualData = null;
            
            // Try multiple extraction patterns
            if (response?.enrichment_data?.data) {
              actualData = response.enrichment_data.data;
            } else if (response?.enrichment_data) {
              actualData = response.enrichment_data;
            } else if (response?.contact_profile) {
              actualData = response;
            }
            
            console.log('🔍 Extracted actualData:', actualData);
            console.log('📋 Data keys:', actualData ? Object.keys(actualData) : 'null');
            
            // Check if we have real data with contact_profile
            if (actualData && 
                Object.keys(actualData).length > 0 && 
                actualData.contact_profile &&
                Object.keys(actualData.contact_profile).length > 0) {
              
              console.log('✅ SUCCESS! Data ready with contact_profile:', actualData);
              
              // ✅ FIX #1: Set data and let useEffect handle tab switch
              setDeepEnrichmentData(actualData as UnifiedEnrichmentResult);
              const parsed = transformDeepEnrichment(actualData as UnifiedEnrichmentResult);
              setParsedProfile(parsed);
              setDeepProfile(JSON.stringify(actualData, null, 2));
              setLastDeepEnriched(actualData.meta?.generated_at || new Date().toISOString());
              setMessage({ type: 'success', text: '✨ Deep enrichment complete!' });
              
              // ✅ FIX #2: Refresh contact to sync all state
              await refreshContact();
              onUpdate?.();
              completed = true;
              setEnrichmentProgress(100);
              break;
            } else {
              console.log(`⏳ Poll ${attempts}: Data not ready or missing contact_profile`);
            }
          } catch (err) {
            console.log(`⚠️ Poll attempt ${attempts} error:`, err);
          }


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



  const getTierColor = (tier?: string) => {
    if (!tier) return '#6b7280';
    switch (tier.toLowerCase()) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };



  const ScoreCard = ({ label, score, tier, icon: Icon }: { label: string, score?: number, tier?: string, icon: React.ElementType }) => (
    <div className={`score-card ${label.toLowerCase()}`}>
      <div className="score-card-icon" style={{ backgroundColor: getTierColor(tier) }}>
        <Icon size={24} />
      </div>
      <div className="score-card-content">
        <span className="score-label">{label}</span>
        <div className="score-row">
          <span className="score-number" style={{ color: getTierColor(tier) }}>{score ?? '--'}</span>
          {tier && <span className="tier-badge" style={{ backgroundColor: getTierColor(tier) }}>{tier.toUpperCase()}</span>}
        </div>
      </div>
    </div>
  );



  const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line: string, i: number) => {
      if (line.startsWith('## ')) return <h2 key={i} className="profile-h2">{line.replace('## ', '')}</h2>;
      if (line.startsWith('### ')) return <h3 key={i} className="profile-h3">{line.replace('### ', '')}</h3>;
      if (line.startsWith('- ')) return <li key={i} className="profile-li">{line.replace('- ', '')}</li>;
      if (line.trim()) return <p key={i} className="profile-p">{line}</p>;
      return null;
    });
  };



  // ✅ IMPROVED: renderDeepEnrichmentSections with better null checks
  const renderDeepEnrichmentSections = () => {
    if (!deepEnrichmentData) {
      console.log('⚠️ renderDeepEnrichmentSections: No deepEnrichmentData');
      return null;
    }
    
    console.log('🎨 Rendering deep enrichment sections:', deepEnrichmentData);
    
    // ✅ SAFE EXTRACTION with defaults
    const contact_profile = deepEnrichmentData.contact_profile || {};
    const company_profile = deepEnrichmentData.company_profile || {};
    const current_focus = deepEnrichmentData.current_focus || {};
    const buying_signals = deepEnrichmentData.buying_signals || {};
    const risks_and_objections = deepEnrichmentData.risks_and_objections || {};
    const messaging = deepEnrichmentData.messaging || {};


    // Check if we have any meaningful data
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
        {/* Contact Profile Section */}
        {contact_profile && Object.keys(contact_profile).length > 0 && (
          <div className="enrichment-card contact-profile-card">
            <div className="card-header">
              <h4>👤 Contact Profile</h4>
            </div>
            <div className="card-body">
              {contact_profile.headline && <p className="headline"><strong>{contact_profile.headline}</strong></p>}
              {contact_profile.role_summary && <p className="role-summary">{contact_profile.role_summary}</p>}
              {contact_profile.seniority && <p className="seniority"><strong>Seniority:</strong> {contact_profile.seniority}</p>}
              
              {contact_profile.background_bullets && contact_profile.background_bullets.length > 0 && (
                <div className="bullets-section">
                  <h5>Background</h5>
                  <ul>
                    {contact_profile.background_bullets.map((bullet: any, i: number) => (
                      <li key={i}>
                        {bullet.text}
                        {bullet.evidence && <span className="evidence"> [{bullet.evidence}]</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Company Profile Section */}
        {company_profile && Object.keys(company_profile).length > 0 && (
          <div className="enrichment-card company-profile-card">
            <div className="card-header">
              <h4>🏢 Company Profile</h4>
            </div>
            <div className="card-body">
              {company_profile.one_liner && <p className="one-liner italic">{company_profile.one_liner}</p>}
              <div className="company-meta">
                {company_profile.industry && <span><strong>Industry:</strong> {company_profile.industry}</span>}
                {company_profile.size_segment && <span><strong>Size:</strong> {company_profile.size_segment}</span>}
                {company_profile.region && <span><strong>Region:</strong> {company_profile.region}</span>}
              </div>
              
              {company_profile.key_products_or_services && company_profile.key_products_or_services.length > 0 && (
                <div className="bullets-section">
                  <h5>Key Products/Services</h5>
                  <ul>
                    {company_profile.key_products_or_services.map((product: any, i: number) => (
                      <li key={i}>{product.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Current Focus Section */}
        {current_focus && Object.keys(current_focus).length > 0 && (
          <div className="enrichment-card current-focus-card">
            <div className="card-header">
              <h4>🎯 Current Focus</h4>
            </div>
            <div className="card-body">
              {current_focus.strategic_initiatives && current_focus.strategic_initiatives.length > 0 && (
                <div className="focus-subsection">
                  <h5>Strategic Initiatives</h5>
                  <ul>
                    {current_focus.strategic_initiatives.map((init: any, i: number) => (
                      <li key={i}>{init.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {current_focus.recent_projects && current_focus.recent_projects.length > 0 && (
                <div className="focus-subsection">
                  <h5>Recent Projects</h5>
                  <ul>
                    {current_focus.recent_projects.map((proj: any, i: number) => (
                      <li key={i}>{proj.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {current_focus.primary_kpis && current_focus.primary_kpis.length > 0 && (
                <div className="focus-subsection">
                  <h5>Primary KPIs</h5>
                  <ul>
                    {current_focus.primary_kpis.map((kpi: any, i: number) => (
                      <li key={i}>{kpi.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Buying Signals Section */}
        {buying_signals && Object.keys(buying_signals).length > 0 && (
          <div className="enrichment-card buying-signals-card signal-card">
            <div className="card-header">
              <h4>🚀 Buying Signals</h4>
            </div>
            <div className="card-body">
              {buying_signals.recent_news && buying_signals.recent_news.length > 0 && (
                <div className="signal-subsection">
                  <h5>Recent News</h5>
                  <ul>
                    {buying_signals.recent_news.map((news: any, i: number) => (
                      <li key={i}>{news.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {buying_signals.timing_triggers && buying_signals.timing_triggers.length > 0 && (
                <div className="signal-subsection">
                  <h5>Timing Triggers</h5>
                  <ul>
                    {buying_signals.timing_triggers.map((trigger: any, i: number) => (
                      <li key={i}>{trigger.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {buying_signals.hiring_signals && buying_signals.hiring_signals.length > 0 && (
                <div className="signal-subsection">
                  <h5>Hiring Signals</h5>
                  <ul>
                    {buying_signals.hiring_signals.map((hire: any, i: number) => (
                      <li key={i}>{hire.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {buying_signals.tech_changes && buying_signals.tech_changes.length > 0 && (
                <div className="signal-subsection">
                  <h5>Tech Changes</h5>
                  <ul>
                    {buying_signals.tech_changes.map((tech: any, i: number) => (
                      <li key={i}>{tech.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Risks & Objections Section */}
        {risks_and_objections && Object.keys(risks_and_objections).length > 0 && (
          <div className="enrichment-card risks-card">
            <div className="card-header">
              <h4>⚠️ Risks & Objections</h4>
            </div>
            <div className="card-body">
              {risks_and_objections.risk_bullets && risks_and_objections.risk_bullets.length > 0 && (
                <div className="risk-subsection">
                  <h5>Risk Factors</h5>
                  <ul>
                    {risks_and_objections.risk_bullets.map((risk: any, i: number) => (
                      <li key={i}>{risk.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {risks_and_objections.likely_objections && risks_and_objections.likely_objections.length > 0 && (
                <div className="risk-subsection">
                  <h5>Likely Objections</h5>
                  <ul>
                    {risks_and_objections.likely_objections.map((obj: any, i: number) => (
                      <li key={i}>{obj.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {risks_and_objections.landmines && risks_and_objections.landmines.length > 0 && (
                <div className="risk-subsection">
                  <h5>Landmines to Avoid</h5>
                  <ul>
                    {risks_and_objections.landmines.map((landmine: any, i: number) => (
                      <li key={i}>{landmine.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Messaging Section */}
        {messaging && Object.keys(messaging).length > 0 && (
          <div className="enrichment-card messaging-card">
            <div className="card-header">
              <h4>💬 Messaging</h4>
            </div>
            <div className="card-body">
              {messaging.cold_openers && messaging.cold_openers.length > 0 && (
                <div className="messaging-subsection">
                  <h5>Cold Openers</h5>
                  <ul>
                    {messaging.cold_openers.map((opener: any, i: number) => (
                      <li key={i}>{opener.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {messaging.value_props && messaging.value_props.length > 0 && (
                <div className="messaging-subsection">
                  <h5>Value Propositions</h5>
                  <ul>
                    {messaging.value_props.map((prop: any, i: number) => (
                      <li key={i}>{prop.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {messaging.call_to_action_ideas && messaging.call_to_action_ideas.length > 0 && (
                <div className="messaging-subsection">
                  <h5>Call-to-Action Ideas</h5>
                  <ul>
                    {messaging.call_to_action_ideas.map((cta: any, i: number) => (
                      <li key={i}>{cta.text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}


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
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <div className="avatar-large">
              {contact.first_name?.charAt(0)}{contact.last_name?.charAt(0)}
            </div>
            <div className="header-info">
              {isEditing ? (
                <div className="edit-name-row">
                  <input 
                    type="text" 
                    value={editData.first_name} 
                    onChange={e => setEditData({...editData, first_name: e.target.value})}
                    placeholder="First name"
                    className="input-name"
                  />
                  <input 
                    type="text" 
                    value={editData.last_name} 
                    onChange={e => setEditData({...editData, last_name: e.target.value})}
                    placeholder="Last name"
                    className="input-name"
                  />
                </div>
              ) : (
                <>
                  <h2>{contact.first_name} {contact.last_name}</h2>
                  <p className="header-subtitle">{contact.title || 'No title'} @ {contact.company || 'Unknown'}</p>
                </>
              )}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}><X size={24} /></button>
        </div>


        {/* Message Banner */}
        {message && (
          <div className={`message-banner ${message.type}`}>
            {message.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
            {message.text}
          </div>
        )}


        {/* Progress Bar for Deep Enrichment */}
        {isDeepEnriching && (
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${enrichmentProgress}%` }} />
            <span className="progress-text">{Math.round(enrichmentProgress)}%</span>
          </div>
        )}


        {/* Action Buttons */}
        <div className="modal-actions">
          {isEditing ? (
            <>
              <button className="btn-action btn-save" onClick={handleSave} disabled={isSaving}>
                <Save size={18} /> {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn-action" onClick={() => { setIsEditing(false); setEditData(contact); }}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn-action" onClick={() => setIsEditing(true)}><Edit2 size={18} /> Edit</button>
              <button className="btn-action btn-enrich" onClick={handleEnrich} disabled={isEnriching}>
                <Sparkles size={18} className={isEnriching ? 'spin' : ''} />
                {isEnriching ? 'Enriching...' : 'Quick Enrich'}
              </button>
              <button 
                className={`btn-action btn-deep-enrich ${deepEnrichmentData ? 'has-profile' : ''}`} 
                onClick={handleDeepEnrich} 
                disabled={isDeepEnriching}
                title={deepEnrichmentData ? `Last enriched: ${lastDeepEnriched ? new Date(lastDeepEnriched).toLocaleDateString() : 'Unknown'}` : ''}
              >
                <Brain size={18} className={isDeepEnriching ? 'spin' : ''} />
                {isDeepEnriching ? 'Deep Researching...' : deepEnrichmentData ? 'Re-Enrich Deep' : 'Deep Enrich'}
              </button>
              <button className="btn-action btn-score" onClick={handleScore} disabled={isScoring}>
                <RefreshCw size={18} className={isScoring ? 'spin' : ''} />
                {isScoring ? 'Scoring...' : 'Recalculate Score'}
              </button>
              <button className="btn-action btn-delete" onClick={handleDelete}><Trash2 size={18} /></button>
            </>
          )}
        </div>


        {/* Tabs */}
        <div className="modal-tabs">
          <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>Contact Info</button>
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
            <Brain size={14} /> Deep Profile {deepEnrichmentData && '✨'}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'scoring' ? 'active' : ''}`} 
            onClick={() => setActiveTab('scoring')}
          >
            Scoring {contact.overall_score && `(${contact.overall_score})`}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'outreach' ? 'active' : ''}`} 
            onClick={() => setActiveTab('outreach')}
          >
            <Send size={14} /> Outreach
          </button>
        </div>


        {/* Tab Content */}
        <div className="modal-body">
          {activeTab === 'info' && (
            <div className="tab-pane">
              <div className="info-grid">
                <div className="info-field">
                  <label><Mail size={16}/> Email</label>
                  {isEditing ? (
                    <input 
                      type="email" 
                      value={editData.email || ''} 
                      onChange={e => setEditData({...editData, email: e.target.value})}
                      className="input-field"
                    />
                  ) : (
                    <a href={`mailto:${contact.email}`} className="info-value link">{contact.email}</a>
                  )}
                </div>
                <div className="info-field">
                  <label><Phone size={16}/> Phone</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editData.phone || ''} 
                      onChange={e => setEditData({...editData, phone: e.target.value})}
                      className="input-field"
                    />
                  ) : (
                    <span className="info-value">{contact.phone || 'No phone'}</span>
                  )}
                </div>
                <div className="info-field">
                  <label><Linkedin size={16}/> LinkedIn</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editData.linkedin_url || ''} 
                      onChange={e => setEditData({...editData, linkedin_url: e.target.value})}
                      className="input-field"
                    />
                  ) : (
                    <a href={contact.linkedin_url || '#'} target="_blank" rel="noreferrer" className="info-value link">
                      {contact.linkedin_url ? 'View Profile' : 'No URL'} <ExternalLink size={12}/>
                    </a>
                  )}
                </div>
                <div className="info-field">
                  <label><Building2 size={16}/> Company</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editData.company || ''} 
                      onChange={e => setEditData({...editData, company: e.target.value})}
                      className="input-field"
                    />
                  ) : (
                    <span className="info-value">{contact.company || 'No company'}</span>
                  )}
                </div>
                <div className="info-field">
                  <label><Briefcase size={16}/> Job Title</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editData.title || ''} 
                      onChange={e => setEditData({...editData, title: e.target.value})}
                      className="input-field"
                    />
                  ) : (
                    <span className="info-value">{contact.title || 'No title'}</span>
                  )}
                </div>
                <div className="info-field">
                  <label><Globe size={16}/> Website</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editData.website || ''} 
                      onChange={e => setEditData({...editData, website: e.target.value})}
                      className="input-field"
                    />
                  ) : (
                    <a href={contact.website || '#'} target="_blank" rel="noreferrer" className="info-value link">
                      {contact.website || 'No website'}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}


          {activeTab === 'enrichment' && (
            <div className="tab-pane">
              {contact.enrichment_status === 'completed' ? (
                <div className="enrichment-results">
                  <p>Standard enrichment data is available. Check scoring or deep profile for details.</p>
                </div>
              ) : (
                <div className="empty-state">
                  <Sparkles size={48} className="empty-icon" />
                  <h3>No enrichment data</h3>
                  <p>Run quick enrich to get basic firmographics and initial scoring.</p>
                  <button className="btn-generate" onClick={handleEnrich} disabled={isEnriching}>
                    {isEnriching ? 'Enriching...' : 'Run Quick Enrich'}
                  </button>
                </div>
              )}
            </div>
          )}


          {activeTab === 'deepprofile' && (
            <div className="tab-pane">
              {deepEnrichmentData && Object.keys(deepEnrichmentData).length > 0 ? (
                renderDeepEnrichmentSections()
              ) : (
                <div className="empty-state">
                  <Brain size={48} className="empty-icon" />
                  <h3>No deep profile yet</h3>
                  <p>Deep enrich uses Perplexity AI for comprehensive research. (10-15 seconds)</p>
                  <button className="btn-generate" onClick={handleDeepEnrich} disabled={isDeepEnriching}>
                    {isDeepEnriching ? 'Researching...' : 'Generate Deep Profile'}
                  </button>
                </div>
              )}
            </div>
          )}


          {activeTab === 'scoring' && (
            <div className="tab-pane">
              <div className="scores-grid">
                <ScoreCard label="Overall" score={contact.overall_score} tier={contact.overall_tier} icon={Award} />
                <ScoreCard label="MDCP" score={contact.mdcp_score} tier={contact.mdcp_tier} icon={Target} />
                <ScoreCard label="BANT" score={contact.bant_score} tier={contact.bant_tier} icon={DollarSign} />
                <ScoreCard label="SPICE" score={contact.spice_score} tier={contact.spice_tier} icon={Activity} />
              </div>
            </div>
          )}


          {activeTab === 'outreach' && (
            <div className="tab-pane">
              <OutreachTab 
                contactId={contact.id} 
                contactName={`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                hasEnrichment={contact.enrichment_status === 'completed'}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

