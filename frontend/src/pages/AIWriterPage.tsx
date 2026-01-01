import React, { useState, useEffect } from 'react';
import { Sparkles, Mail, Copy, Download, RefreshCw, CheckCircle, Wand2 } from 'lucide-react';
import '../styles/AIWriterPage.css';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  title?: string;
  mdcp_score?: number;
  enrichment_status?: string;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  preview_text: string;
  contact_id: string;
  template_type: string;
  generated_at: string;
}

const TEMPLATES = [
  { id: 'cold_outreach', name: 'Cold Outreach', icon: '❄️', description: 'First contact email' },
  { id: 'follow_up', name: 'Follow Up', icon: '🔄', description: 'Follow up on previous email' },
  { id: 'meeting_request', name: 'Meeting Request', icon: '📅', description: 'Request a meeting' },
  { id: 'value_prop', name: 'Value Proposition', icon: '💎', description: 'Share value proposition' },
  { id: 'breakup', name: 'Breakup Email', icon: '👋', description: 'Last attempt email' }
];

const TONES = [
  { id: 'professional', name: 'Professional', icon: '👔' },
  { id: 'casual', name: 'Casual', icon: '😊' },
  { id: 'friendly', name: 'Friendly', icon: '🤝' },
  { id: 'urgent', name: 'Urgent', icon: '⚡' }
];

export const AIWriterPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [template, setTemplate] = useState('cold_outreach');
  const [tone, setTone] = useState('professional');
  const [customContext, setCustomContext] = useState('');
  const [includeCTA, setIncludeCTA] = useState(true);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      // In production: const response = await fetch('/api/v3/contacts?enrichment_status=completed');
      // Mock data for demo
      const mockContacts: Contact[] = [
        {
          id: '1',
          first_name: 'John',
          last_name: 'Smith',
          email: 'john@acme.com',
          company: 'Acme Inc',
          title: 'VP Sales',
          mdcp_score: 85,
          enrichment_status: 'completed'
        },
        {
          id: '2',
          first_name: 'Sarah',
          last_name: 'Johnson',
          email: 'sarah@techcorp.com',
          company: 'TechCorp',
          title: 'CEO',
          mdcp_score: 92,
          enrichment_status: 'completed'
        }
      ];
      setContacts(mockContacts);
      if (mockContacts.length > 0) {
        setSelectedContact(mockContacts[0]);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const generateEmail = async () => {
    if (!selectedContact) return;

    setLoading(true);
    try {
      // In production:
      // const response = await fetch('/api/v3/ai-writer/generate-email', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     contact_id: selectedContact.id,
      //     template_type: template,
      //     tone: tone,
      //     custom_context: customContext,
      //     include_cta: includeCTA
      //   })
      // });

      // Mock generation delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockEmail: GeneratedEmail = {
        subject: `Quick question about ${selectedContact.company}'s sales process`,
        body: `Hi ${selectedContact.first_name},

I noticed that ${selectedContact.company} has been scaling rapidly in the ${selectedContact.title || 'leadership'} space, and I wanted to reach out.

${customContext || 'We help companies like yours streamline their sales intelligence and lead scoring workflows.'}

I'd love to share how we've helped similar companies increase their conversion rates by 40% through AI-powered lead prioritization.

Would you be open to a quick 15-minute call this week to explore if there's a fit?

Best regards,
Your Sales Team`,
        preview_text: `Hi ${selectedContact.first_name}, I noticed that ${selectedContact.company} has been scaling...`,
        contact_id: selectedContact.id,
        template_type: template,
        generated_at: new Date().toISOString()
      };

      setGeneratedEmail(mockEmail);
    } catch (err) {
      console.error('Failed to generate email:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedEmail) return;
    
    const fullEmail = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadEmail = () => {
    if (!generatedEmail) return;
    
    const fullEmail = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
    const blob = new Blob([fullEmail], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-${selectedContact?.first_name}-${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="ai-writer-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-main">
          <Sparkles size={32} />
          <div>
            <h1>AI Email Writer</h1>
            <p>Generate personalized outreach emails using enrichment data</p>
          </div>
        </div>
      </div>

      <div className="writer-grid">
        {/* Left: Configuration */}
        <div className="config-panel">
          <div className="config-section">
            <h3>Select Contact</h3>
            <select
              value={selectedContact?.id || ''}
              onChange={(e) => {
                const contact = contacts.find(c => c.id === e.target.value);
                setSelectedContact(contact || null);
              }}
              className="form-select"
            >
              {contacts.map(contact => (
                <option key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name} - {contact.company}
                </option>
              ))}
            </select>
            
            {selectedContact && (
              <div className="contact-preview">
                <div className="contact-avatar">
                  {selectedContact.first_name?.[0]}{selectedContact.last_name?.[0]}
                </div>
                <div className="contact-info">
                  <h4>{selectedContact.first_name} {selectedContact.last_name}</h4>
                  <p>{selectedContact.title}</p>
                  <p className="contact-company">{selectedContact.company}</p>
                  <div className="contact-score">
                    <span className="score-badge">{selectedContact.mdcp_score}</span>
                    <span className="score-label">MDCP Score</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="config-section">
            <h3>Template Type</h3>
            <div className="template-grid">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  className={`template-btn ${template === t.id ? 'active' : ''}`}
                  onClick={() => setTemplate(t.id)}
                >
                  <span className="template-icon">{t.icon}</span>
                  <span className="template-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="config-section">
            <h3>Tone</h3>
            <div className="tone-grid">
              {TONES.map(t => (
                <button
                  key={t.id}
                  className={`tone-btn ${tone === t.id ? 'active' : ''}`}
                  onClick={() => setTone(t.id)}
                >
                  <span className="tone-icon">{t.icon}</span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="config-section">
            <h3>Custom Context (Optional)</h3>
            <textarea
              className="form-textarea"
              placeholder="Add any specific context or talking points..."
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              rows={4}
            />
          </div>

          <div className="config-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeCTA}
                onChange={(e) => setIncludeCTA(e.target.checked)}
              />
              <span>Include Call-to-Action</span>
            </label>
          </div>

          <button
            className="btn-generate"
            onClick={generateEmail}
            disabled={loading || !selectedContact}
          >
            {loading ? (
              <>
                <RefreshCw className="spin" size={20} />
                Generating...
              </>
            ) : (
              <>
                <Wand2 size={20} />
                Generate Email
              </>
            )}
          </button>
        </div>

        {/* Right: Generated Email */}
        <div className="email-panel">
          {generatedEmail ? (
            <>
              <div className="email-header">
                <div className="email-title">
                  <Mail size={24} />
                  <h3>Generated Email</h3>
                </div>
                <div className="email-actions">
                  <button className="btn-icon" onClick={copyToClipboard} title="Copy to clipboard">
                    {copied ? <CheckCircle size={20} color="#10b981" /> : <Copy size={20} />}
                  </button>
                  <button className="btn-icon" onClick={downloadEmail} title="Download as .txt">
                    <Download size={20} />
                  </button>
                  <button className="btn-secondary" onClick={generateEmail}>
                    <RefreshCw size={16} />
                    Regenerate
                  </button>
                </div>
              </div>

              <div className="email-content">
                <div className="email-field">
                  <label>Subject:</label>
                  <div className="email-subject">{generatedEmail.subject}</div>
                </div>

                <div className="email-field">
                  <label>Body:</label>
                  <div className="email-body">{generatedEmail.body}</div>
                </div>

                <div className="email-meta">
                  <span className="meta-item">
                    Template: <strong>{TEMPLATES.find(t => t.id === template)?.name}</strong>
                  </span>
                  <span className="meta-item">
                    Tone: <strong>{TONES.find(t => t.id === tone)?.name}</strong>
                  </span>
                  <span className="meta-item">
                    Generated: <strong>{new Date(generatedEmail.generated_at).toLocaleString()}</strong>
                  </span>
                </div>
              </div>

              {copied && (
                <div className="success-banner">
                  <CheckCircle size={20} />
                  <span>Email copied to clipboard!</span>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Sparkles size={64} />
              <h3>Ready to write amazing emails?</h3>
              <p>Configure your settings and click "Generate Email" to create personalized outreach emails powered by AI.</p>
              <div className="features-list">
                <div className="feature-item">
                  <CheckCircle size={20} />
                  <span>Uses enrichment data for personalization</span>
                </div>
                <div className="feature-item">
                  <CheckCircle size={20} />
                  <span>Multiple templates and tones</span>
                </div>
                <div className="feature-item">
                  <CheckCircle size={20} />
                  <span>Customizable with your own context</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIWriterPage;
