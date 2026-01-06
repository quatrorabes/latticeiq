import React, { useState, useEffect } from 'react';
import { 
  Mail, Copy, Check, Star, Send, RefreshCw, Loader2, 
  AlertCircle, Sparkles, ExternalLink, Clock, Trash2 
} from 'lucide-react';
import { 
  EmailVariant, 
  generateEmails, 
  getContactEmails, 
  toggleEmailFavorite,
  markEmailAsSent,
  deleteEmail,
  getBusinessProfile
} from '../api/outreach';
import '../styles/OutreachTab.css';

interface Props {
  contactId: string;
  contactName: string;
  hasEnrichment: boolean;
}

export const OutreachTab: React.FC<Props> = ({ contactId, contactName, hasEnrichment }) => {
  const [emails, setEmails] = useState<EmailVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasBusinessProfile, setHasBusinessProfile] = useState<boolean | null>(null);
  const [numVariants, setNumVariants] = useState(3);

  useEffect(() => {
    checkBusinessProfile();
    loadEmails();
  }, [contactId]);

  const checkBusinessProfile = async () => {
    try {
      const { exists } = await getBusinessProfile();
      setHasBusinessProfile(exists);
    } catch (e) {
      setHasBusinessProfile(false);
    }
  };

  const loadEmails = async () => {
    try {
      const { emails: existingEmails } = await getContactEmails(contactId);
      setEmails(existingEmails);
    } catch (e) {
      console.error('Failed to load emails:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      const result = await generateEmails(contactId, numVariants);
      setEmails(result.variants);
    } catch (e: any) {
      setError(e.message || 'Failed to generate emails');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (email: EmailVariant) => {
    const text = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(email.id || email.variant_number.toString());
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleFavorite = async (emailId: string) => {
    try {
      const { is_favorite } = await toggleEmailFavorite(emailId);
      setEmails(emails.map(e => 
        e.id === emailId ? { ...e, is_favorite } : e
      ));
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
    }
  };

  const handleMarkSent = async (emailId: string) => {
    try {
      const { sent_at } = await markEmailAsSent(emailId);
      setEmails(emails.map(e => 
        e.id === emailId ? { ...e, is_sent: true, sent_at } : e
      ));
    } catch (e) {
      console.error('Failed to mark as sent:', e);
    }
  };

  const handleDelete = async (emailId: string) => {
    if (!confirm('Delete this email variant?')) return;
    try {
      await deleteEmail(emailId);
      setEmails(emails.filter(e => e.id !== emailId));
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  const getStyleEmoji = (style: string) => {
    switch (style) {
      case 'problem_agitate_solve': return '🎯';
      case 'social_proof': return '🏆';
      case 'value_first': return '🎁';
      case 'trigger_event': return '📰';
      case 'curiosity_gap': return '🤔';
      default: return '✉️';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  // Loading state
  if (loading) {
    return (
      <div className="outreach-loading">
        <Loader2 className="spin" size={32} />
        <p>Loading outreach content...</p>
      </div>
    );
  }

  // No business profile
  if (hasBusinessProfile === false) {
    return (
      <div className="outreach-empty-state">
        <AlertCircle size={48} className="empty-icon warning" />
        <h3>Business Profile Required</h3>
        <p>
          Before generating personalized emails, you need to set up your business profile. 
          This tells the AI about your value proposition and how to position your outreach.
        </p>
        <a href="/settings" className="btn-setup">
          <Sparkles size={18} /> Set Up Business Profile
        </a>
      </div>
    );
  }

  // No enrichment
  if (!hasEnrichment) {
    return (
      <div className="outreach-empty-state">
        <AlertCircle size={48} className="empty-icon" />
        <h3>Deep Enrichment Required</h3>
        <p>
          Run Deep Enrich first to gather intelligence about {contactName}. 
          This data powers hyper-personalized email generation.
        </p>
      </div>
    );
  }

  // No emails yet
  if (emails.length === 0) {
    return (
      <div className="outreach-empty-state">
        <Mail size={48} className="empty-icon" />
        <h3>Generate Personalized Emails</h3>
        <p>
          Create {numVariants} hyper-personalized email variants for {contactName} 
          using their enrichment data and your business profile.
        </p>
        
        <div className="variant-selector">
          <label>Number of variants:</label>
          <div className="variant-buttons">
            {[3, 4, 5].map(n => (
              <button 
                key={n}
                className={`variant-btn ${numVariants === n ? 'active' : ''}`}
                onClick={() => setNumVariants(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        
        <button 
          onClick={handleGenerate} 
          disabled={generating}
          className="btn-generate"
        >
          {generating ? (
            <>
              <Loader2 size={18} className="spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles size={18} /> Generate {numVariants} Email Variants
            </>
          )}
        </button>
        
        {error && (
          <div className="error-message">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>
    );
  }

  // Email variants display
  return (
    <div className="outreach-content">
      <div className="outreach-header">
        <div className="header-info">
          <h4>{emails.length} Email Variants</h4>
          <p>Generated for {contactName}</p>
        </div>
        <button 
          onClick={handleGenerate} 
          disabled={generating}
          className="btn-regenerate"
        >
          {generating ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Regenerate
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      
      <div className="emails-list">
        {emails.map((email) => (
          <div 
            key={email.id || email.variant_number} 
            className={`email-card ${email.is_sent ? 'sent' : ''} ${email.is_favorite ? 'favorite' : ''}`}
          >
            <div className="email-header">
              <div className="email-style">
                <span className="style-emoji">{getStyleEmoji(email.style)}</span>
                <span className="style-name">
                  {email.style.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
              <div className="email-meta">
                <span 
                  className="quality-score"
                  style={{ color: getQualityColor(email.quality_score) }}
                  title={email.quality_notes}
                >
                  {email.quality_score}%
                </span>
                {email.is_sent && (
                  <span className="sent-badge">
                    <Check size={12} /> Sent
                  </span>
                )}
              </div>
            </div>
            
            <div className="email-content">
              <div className="email-subject">
                <strong>Subject:</strong> {email.subject}
              </div>
              <div className="email-body">
                {email.body.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < email.body.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
            
            {email.quality_notes && (
              <div className="quality-notes">
                {email.quality_notes}
              </div>
            )}
            
            <div className="email-actions">
              <button 
                onClick={() => handleCopy(email)}
                className="action-btn copy"
                title="Copy to clipboard"
              >
                {copiedId === (email.id || email.variant_number.toString()) ? (
                  <><Check size={14} /> Copied!</>
                ) : (
                  <><Copy size={14} /> Copy</>
                )}
              </button>
              
              {email.id && (
                <>
                  <button 
                    onClick={() => handleToggleFavorite(email.id!)}
                    className={`action-btn favorite ${email.is_favorite ? 'active' : ''}`}
                    title="Toggle favorite"
                  >
                    <Star size={14} fill={email.is_favorite ? 'currentColor' : 'none'} />
                  </button>
                  
                  {!email.is_sent && (
                    <button 
                      onClick={() => handleMarkSent(email.id!)}
                      className="action-btn send"
                      title="Mark as sent"
                    >
                      <Send size={14} /> Mark Sent
                    </button>
                  )}
                  
                  <button 
                    onClick={() => handleDelete(email.id!)}
                    className="action-btn delete"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OutreachTab;
