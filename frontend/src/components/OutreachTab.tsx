import React, { useState, useEffect } from 'react';
import {
  Mail, Phone, Sparkles, Copy, Check, Star, Send,
  RefreshCw, ChevronDown, ChevronUp, AlertCircle,
  Brain, User, Building2
} from 'lucide-react';

interface EmailVariant {
  id?: string;
  variant_number: number;
  style: string;
  style_description: string;
  subject: string;
  body: string;
  quality_score: number;
  quality_notes: string;
  is_favorite?: boolean;
  is_sent?: boolean;
}

interface CallScriptVariant {
  variant_number: number;
  style: string;
  style_description: string;
  script: string;
}

interface PersonalityInfo {
  mbti: string | null;
  disc: string;
  disc_name: string;
}

interface Contact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  company?: string;
  title?: string;
}

interface OutreachTabProps {
  contact: Contact;
  onUpdate?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

export const OutreachTab: React.FC<OutreachTabProps> = ({ contact, onUpdate }) => {
  // Tab state
  const [activeSubTab, setActiveSubTab] = useState<'emails' | 'calls'>('emails');

  // Email state
  const [emails, setEmails] = useState<EmailVariant[]>([]);
  const [isGeneratingEmails, setIsGeneratingEmails] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Call script state
  const [callScripts, setCallScripts] = useState<CallScriptVariant[]>([]);
  const [personality, setPersonality] = useState<PersonalityInfo | null>(null);
  const [isGeneratingCalls, setIsGeneratingCalls] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  // UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedVariant, setExpandedVariant] = useState<number | null>(1);

  // Load existing content on mount
  useEffect(() => {
    loadExistingEmails();
    loadExistingCallScripts();
  }, [contact.id]);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const { supabase } = await import('../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  };

  const loadExistingEmails = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/v3/outreach/emails/${contact.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.emails && data.emails.length > 0) {
          setEmails(data.emails.map((e: any) => ({
            id: e.id,
            variant_number: e.variant_number,
            style: e.style,
            style_description: e.style_description,
            subject: e.subject,
            body: e.body,
            quality_score: e.quality_score,
            quality_notes: e.quality_notes,
            is_favorite: e.is_favorite,
            is_sent: e.is_sent
          })));
        }
      }
    } catch (err) {
      console.error('Failed to load emails:', err);
    }
  };

  const loadExistingCallScripts = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/v3/outreach/call-scripts/${contact.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scripts && data.scripts.length > 0) {
          setCallScripts(data.scripts.map((s: any) => ({
            variant_number: s.variant_number,
            style: s.style,
            style_description: s.style_description,
            script: s.body
          })));
        }
      }
    } catch (err) {
      console.error('Failed to load call scripts:', err);
    }
  };

  const generateEmails = async () => {
    setIsGeneratingEmails(true);
    setEmailError(null);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/v3/outreach/generate-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          contact_id: contact.id,
          num_variants: 3
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to generate emails');
      }

      const data = await res.json();
      setEmails(data.variants);
      onUpdate?.();
    } catch (err: any) {
      setEmailError(err.message || 'Failed to generate emails');
    } finally {
      setIsGeneratingEmails(false);
    }
  };

  const generateCallScripts = async () => {
    setIsGeneratingCalls(true);
    setCallError(null);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/v3/outreach/generate-call-scripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          contact_id: contact.id
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to generate call scripts');
      }

      const data = await res.json();
      setCallScripts(data.scripts);
      setPersonality(data.personality);
      onUpdate?.();
    } catch (err: any) {
      setCallError(err.message || 'Failed to generate call scripts');
    } finally {
      setIsGeneratingCalls(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleFavorite = async (emailId: string) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/v3/outreach/emails/${emailId}/favorite`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setEmails(prev => prev.map(e =>
          e.id === emailId ? { ...e, is_favorite: data.is_favorite } : e
        ));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const markAsSent = async (emailId: string) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/api/v3/outreach/emails/${emailId}/sent`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setEmails(prev => prev.map(e =>
          e.id === emailId ? { ...e, is_sent: true } : e
        ));
      }
    } catch (err) {
      console.error('Failed to mark as sent:', err);
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getStyleEmoji = (style: string) => {
    const emojis: Record<string, string> = {
      'problem_agitate_solve': '🎯',
      'social_proof': '🏆',
      'value_first': '🎁',
      'trigger_event': '📰',
      'curiosity_gap': '🤔',
      'Direct & Value-Focused': '⚡',
      'Consultative & Rapport-Building': '🤝',
      'Executive / Insight-Led': '💡'
    };
    return emojis[style] || '📧';
  };

  const getDISCColor = (disc: string) => {
    const colors: Record<string, string> = {
      'D': '#ef4444',
      'I': '#f59e0b',
      'S': '#22c55e',
      'C': '#3b82f6'
    };
    return colors[disc] || '#6366f1';
  };

  return (
    <div className="outreach-tab">
      {/* Sub-tab navigation */}
      <div className="outreach-sub-tabs">
        <button
          className={`sub-tab ${activeSubTab === 'emails' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('emails')}
        >
          <Mail size={16} />
          Emails
          {emails.length > 0 && <span className="badge">{emails.length}</span>}
        </button>
        <button
          className={`sub-tab ${activeSubTab === 'calls' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('calls')}
        >
          <Phone size={16} />
          Call Scripts
          {callScripts.length > 0 && <span className="badge">{callScripts.length}</span>}
        </button>
      </div>

      {/* EMAIL TAB */}
      {activeSubTab === 'emails' && (
        <div className="emails-section">
          {/* Header */}
          <div className="section-header">
            <div className="header-info">
              <h4>Email Variants</h4>
              <p>AI-generated personalized emails using enrichment data</p>
            </div>
            <button
              className="btn-generate"
              onClick={generateEmails}
              disabled={isGeneratingEmails}
            >
              {isGeneratingEmails ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  Generating...
                </>
              ) : emails.length > 0 ? (
                <>
                  <RefreshCw size={16} />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Emails
                </>
              )}
            </button>
          </div>

          {emailError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              {emailError}
            </div>
          )}

          {/* Email variants */}
          {emails.length > 0 ? (
            <div className="variants-list">
              {emails.map((email) => (
                <div
                  key={email.variant_number}
                  className={`variant-card ${expandedVariant === email.variant_number ? 'expanded' : ''}`}
                >
                  <div
                    className="variant-header"
                    onClick={() => setExpandedVariant(
                      expandedVariant === email.variant_number ? null : email.variant_number
                    )}
                  >
                    <div className="variant-meta">
                      <span className="style-emoji">{getStyleEmoji(email.style)}</span>
                      <div className="variant-info">
                        <span className="variant-title">
                          {email.style.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span className="variant-desc">{email.style_description}</span>
                      </div>
                    </div>
                    <div className="variant-actions">
                      <div
                        className="quality-badge"
                        style={{ backgroundColor: `${getQualityColor(email.quality_score)}20`, color: getQualityColor(email.quality_score) }}
                      >
                        {email.quality_score}%
                      </div>
                      {email.is_sent && <span className="sent-badge">✓ Sent</span>}
                      {expandedVariant === email.variant_number ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {expandedVariant === email.variant_number && (
                    <div className="variant-content">
                      <div className="email-preview">
                        <div className="email-subject">
                          <strong>Subject:</strong> {email.subject}
                          <button
                            className="copy-btn"
                            onClick={() => copyToClipboard(email.subject, `subject-${email.variant_number}`)}
                          >
                            {copiedId === `subject-${email.variant_number}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="email-body">
                          <pre>{email.body}</pre>
                        </div>
                      </div>

                      <div className="quality-notes">
                        <span className="notes-label">Quality Notes:</span>
                        {email.quality_notes}
                      </div>

                      <div className="variant-footer">
                        <button
                          className="action-btn"
                          onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`, `full-${email.variant_number}`)}
                        >
                          {copiedId === `full-${email.variant_number}` ? <Check size={14} /> : <Copy size={14} />}
                          {copiedId === `full-${email.variant_number}` ? 'Copied!' : 'Copy All'}
                        </button>
                        {email.id && (
                          <>
                            <button
                              className={`action-btn ${email.is_favorite ? 'active' : ''}`}
                              onClick={() => toggleFavorite(email.id!)}
                            >
                              <Star size={14} fill={email.is_favorite ? 'currentColor' : 'none'} />
                              Favorite
                            </button>
                            {!email.is_sent && (
                              <button
                                className="action-btn primary"
                                onClick={() => markAsSent(email.id!)}
                              >
                                <Send size={14} />
                                Mark Sent
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !isGeneratingEmails && (
            <div className="empty-state">
              <Mail size={48} className="empty-icon" />
              <h3>No emails generated yet</h3>
              <p>Generate personalized email variants based on contact enrichment data.</p>
              <button className="btn-generate primary" onClick={generateEmails}>
                <Sparkles size={16} />
                Generate Emails
              </button>
            </div>
          )}
        </div>
      )}

      {/* CALL SCRIPTS TAB */}
      {activeSubTab === 'calls' && (
        <div className="calls-section">
          {/* Header */}
          <div className="section-header">
            <div className="header-info">
              <h4>Call Scripts</h4>
              <p>DISC personality-optimized cold call scripts</p>
            </div>
            <button
              className="btn-generate"
              onClick={generateCallScripts}
              disabled={isGeneratingCalls}
            >
              {isGeneratingCalls ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  Generating...
                </>
              ) : callScripts.length > 0 ? (
                <>
                  <RefreshCw size={16} />
                  Regenerate
                </>
              ) : (
                <>
                  <Phone size={16} />
                  Generate Scripts
                </>
              )}
            </button>
          </div>

          {callError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              {callError}
            </div>
          )}

          {/* Personality badge */}
          {personality && (
            <div className="personality-banner" style={{ borderColor: getDISCColor(personality.disc) }}>
              <Brain size={20} style={{ color: getDISCColor(personality.disc) }} />
              <div className="personality-info">
                <span className="disc-type" style={{ color: getDISCColor(personality.disc) }}>
                  {personality.disc}-Type: {personality.disc_name}
                </span>
                {personality.mbti && (
                  <span className="mbti-type">MBTI: {personality.mbti}</span>
                )}
              </div>
            </div>
          )}

          {/* Call script variants */}
          {callScripts.length > 0 ? (
            <div className="scripts-list">
              {callScripts.map((script) => (
                <div
                  key={script.variant_number}
                  className={`script-card ${expandedVariant === script.variant_number ? 'expanded' : ''}`}
                >
                  <div
                    className="script-header"
                    onClick={() => setExpandedVariant(
                      expandedVariant === script.variant_number ? null : script.variant_number
                    )}
                  >
                    <div className="script-meta">
                      <span className="style-emoji">{getStyleEmoji(script.style)}</span>
                      <div className="script-info">
                        <span className="script-title">{script.style}</span>
                        <span className="script-desc">{script.style_description}</span>
                      </div>
                    </div>
                    <div className="script-actions">
                      <span className="variant-badge">Variant {script.variant_number}</span>
                      {expandedVariant === script.variant_number ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {expandedVariant === script.variant_number && (
                    <div className="script-content">
                      <pre className="script-body">{script.script}</pre>
                      <div className="script-footer">
                        <button
                          className="action-btn"
                          onClick={() => copyToClipboard(script.script, `script-${script.variant_number}`)}
                        >
                          {copiedId === `script-${script.variant_number}` ? <Check size={14} /> : <Copy size={14} />}
                          {copiedId === `script-${script.variant_number}` ? 'Copied!' : 'Copy Script'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : !isGeneratingCalls && (
            <div className="empty-state">
              <Phone size={48} className="empty-icon" />
              <h3>No call scripts generated yet</h3>
              <p>Generate DISC personality-optimized call scripts for more effective conversations.</p>
              <button className="btn-generate primary" onClick={generateCallScripts}>
                <Phone size={16} />
                Generate Call Scripts
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .outreach-tab {
          padding: 1rem 0;
        }

        .outreach-sub-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          padding-bottom: 0.5rem;
        }

        .sub-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #94a3b8;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sub-tab:hover {
          background: rgba(99, 102, 241, 0.1);
          color: #f8fafc;
        }

        .sub-tab.active {
          background: rgba(99, 102, 241, 0.15);
          color: #6366f1;
        }

        .sub-tab .badge {
          background: rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
          padding: 0.125rem 0.5rem;
          border-radius: 10px;
          font-size: 0.75rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .header-info h4 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .header-info p {
          margin: 0.25rem 0 0;
          font-size: 0.85rem;
          color: #64748b;
        }

        .btn-generate {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-generate:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
        }

        .btn-generate:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-generate.primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #ef4444;
          margin-bottom: 1rem;
        }

        .personality-banner {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(99, 102, 241, 0.05);
          border: 1px solid;
          border-radius: 10px;
          margin-bottom: 1.5rem;
        }

        .personality-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .disc-type {
          font-weight: 700;
          font-size: 1rem;
        }

        .mbti-type {
          font-size: 0.85rem;
          color: #94a3b8;
        }

        .variants-list, .scripts-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .variant-card, .script-card {
          background: #1e293b;
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .variant-card:hover, .script-card:hover {
          border-color: rgba(99, 102, 241, 0.3);
        }

        .variant-header, .script-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          cursor: pointer;
        }

        .variant-meta, .script-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .style-emoji {
          font-size: 1.5rem;
        }

        .variant-info, .script-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .variant-title, .script-title {
          font-weight: 600;
          color: #f8fafc;
        }

        .variant-desc, .script-desc {
          font-size: 0.8rem;
          color: #64748b;
        }

        .variant-actions, .script-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: #64748b;
        }

        .quality-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.85rem;
        }

        .sent-badge {
          padding: 0.25rem 0.5rem;
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .variant-badge {
          padding: 0.25rem 0.75rem;
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .variant-content, .script-content {
          padding: 0 1.25rem 1.25rem;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }

        .email-preview {
          background: #0f172a;
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
        }

        .email-subject {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          margin-bottom: 0.75rem;
          color: #e2e8f0;
        }

        .email-subject strong {
          color: #94a3b8;
        }

        .copy-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0.25rem;
        }

        .copy-btn:hover {
          color: #6366f1;
        }

        .email-body pre, .script-body {
          white-space: pre-wrap;
          font-family: inherit;
          font-size: 0.9rem;
          line-height: 1.6;
          color: #e2e8f0;
          margin: 0;
        }

        .script-body {
          background: #0f172a;
          border-radius: 8px;
          padding: 1.25rem;
          margin: 1rem 0;
          max-height: 400px;
          overflow-y: auto;
        }

        .quality-notes {
          font-size: 0.8rem;
          color: #64748b;
          padding: 0.5rem 0;
        }

        .notes-label {
          color: #94a3b8;
          margin-right: 0.5rem;
        }

        .variant-footer, .script-footer {
          display: flex;
          gap: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
          margin-top: 0.5rem;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.875rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 6px;
          color: #a5b4fc;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.5);
        }

        .action-btn.active {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
          color: #f59e0b;
        }

        .action-btn.primary {
          background: #6366f1;
          border-color: #6366f1;
          color: white;
        }

        .action-btn.primary:hover {
          background: #4f46e5;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
        }

        .empty-icon {
          color: #334155;
          margin-bottom: 1rem;
        }

        .empty-state h3 {
          margin: 0 0 0.5rem;
          color: #f8fafc;
          font-weight: 600;
        }

        .empty-state p {
          margin: 0 0 1.5rem;
          color: #64748b;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default OutreachTab;
