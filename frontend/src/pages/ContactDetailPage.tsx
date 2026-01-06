import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { fetchContact, Contact } from '../api/contacts';
import { deepEnrichContact, getEnrichmentResult } from '../api/enrichment';
import { supabase } from '../lib/supabaseClient';
import '../styles/ContactDetailPage.css';

interface EnrichmentResponse {
  contact_profile?: any;
  company_profile?: any;
  current_focus?: any;
  buying_signals?: any;
  risks_and_objections?: any;
  messaging?: any;
  meta?: any;
}

export const ContactDetailPage: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  const [contact, setContact] = useState<Contact | null>(null);
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEnriching, setIsEnriching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [rawJson, setRawJson] = useState<string>('');

  // Load contact on mount
  useEffect(() => {
    loadContact();
  }, [contactId]);

  const loadContact = async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      const contact = await fetchContact(contactId);
      setContact(contact);

      // If contact already has enrichment data, parse it
      if (contact.enrichment_data) {
        try {
          const parsed = JSON.parse(contact.enrichment_data);
          setEnrichmentData(parsed);
          setRawJson(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('Could not parse stored enrichment data:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load contact:', err);
      setMessage({ type: 'error', text: 'Failed to load contact' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeepEnrich = async () => {
    if (!contactId) return;

    setIsEnriching(true);
    setMessage(null);
    setEnrichmentProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setMessage({ type: 'error', text: 'Not authenticated' });
        setIsEnriching(false);
        return;
      }

      console.log('🚀 Starting deep enrichment...');
      setMessage({ type: 'success', text: 'Starting deep enrichment...' });
      setEnrichmentProgress(10);

      const result = await deepEnrichContact(contactId, token);
      console.log('✅ Enrichment triggered:', result);

      setEnrichmentProgress(30);

      // Poll for results
      let attempts = 0;
      const maxAttempts = 30;
      let completed = false;

      while (attempts < maxAttempts && !completed) {
        attempts++;
        setEnrichmentProgress(30 + (attempts / maxAttempts) * 60);

        try {
          const response = await getEnrichmentResult(contactId, token);
          console.log(`🔍 Poll ${attempts}:`, response);

          // Extract data from response
          let actualData = null;
          if (response?.enrichment_data?.data) {
            actualData = response.enrichment_data.data;
          } else if (response?.enrichment_data) {
            actualData = response.enrichment_data;
          } else if (response?.contact_profile) {
            actualData = response;
          }

          if (actualData && Object.keys(actualData).length > 0 && actualData.contact_profile) {
            console.log('✅ SUCCESS! Got enrichment data:', actualData);
            setEnrichmentData(actualData);
            setRawJson(JSON.stringify(actualData, null, 2));
            setMessage({ type: 'success', text: '✨ Deep enrichment complete!' });
            setEnrichmentProgress(100);
            completed = true;
            break;
          }
        } catch (err) {
          console.log(`⚠️ Poll ${attempts} error:`, err);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!completed) {
        setMessage({ type: 'error', text: 'Enrichment timeout after 60 seconds' });
      }
    } catch (err: any) {
      console.error('❌ Enrichment error:', err);
      setMessage({ type: 'error', text: err.message || 'Enrichment failed' });
    } finally {
      setIsEnriching(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="contact-detail-page">
        <div className="loading-container">
          <Loader size={48} className="spin" />
          <p>Loading contact...</p>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="contact-detail-page">
        <div className="error-container">
          <AlertCircle size={48} />
          <p>Contact not found</p>
          <button onClick={() => navigate('/contacts')} className="btn-back">
            Back to Contacts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-detail-page">
      {/* Header */}
      <div className="detail-header">
        <button onClick={() => navigate('/contacts')} className="btn-back">
          <ArrowLeft size={20} /> Back
        </button>
        <div className="header-content">
          <h1>{contact.first_name} {contact.last_name}</h1>
          <p className="subtitle">{contact.title} @ {contact.company}</p>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Progress Bar */}
      {isEnriching && (
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${enrichmentProgress}%` }} />
          <span className="progress-text">{Math.round(enrichmentProgress)}%</span>
        </div>
      )}

      {/* Action Button */}
      <div className="action-bar">
        <button
          onClick={handleDeepEnrich}
          disabled={isEnriching}
          className="btn-enrich"
        >
          {isEnriching ? 'Enriching...' : enrichmentData ? 'Re-Enrich' : 'Run Deep Enrichment'}
        </button>
      </div>

      {/* Content */}
      <div className="content-area">
        {/* Basic Contact Info */}
        <div className="section">
          <h2>Contact Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Email</label>
              <p>{contact.email || 'N/A'}</p>
            </div>
            <div className="info-item">
              <label>Phone</label>
              <p>{contact.phone || 'N/A'}</p>
            </div>
            <div className="info-item">
              <label>Title</label>
              <p>{contact.title || 'N/A'}</p>
            </div>
            <div className="info-item">
              <label>Company</label>
              <p>{contact.company || 'N/A'}</p>
            </div>
            <div className="info-item">
              <label>LinkedIn</label>
              <p>
                {contact.linkedin_url ? (
                  <a href={contact.linkedin_url} target="_blank" rel="noreferrer">
                    View Profile
                  </a>
                ) : (
                  'N/A'
                )}
              </p>
            </div>
            <div className="info-item">
              <label>Overall Score</label>
              <p>{contact.overall_score || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Enrichment Data */}
        {enrichmentData ? (
          <div className="section">
            <h2>Deep Enrichment Data</h2>

            {/* Contact Profile */}
            {enrichmentData.contact_profile && (
              <div className="subsection">
                <h3>👤 Contact Profile</h3>
                <div className="data-display">
                  {enrichmentData.contact_profile.headline && (
                    <div className="data-item">
                      <strong>Headline:</strong> {enrichmentData.contact_profile.headline}
                    </div>
                  )}
                  {enrichmentData.contact_profile.role_summary && (
                    <div className="data-item">
                      <strong>Role Summary:</strong> {enrichmentData.contact_profile.role_summary}
                    </div>
                  )}
                  {enrichmentData.contact_profile.seniority && (
                    <div className="data-item">
                      <strong>Seniority:</strong> {enrichmentData.contact_profile.seniority}
                    </div>
                  )}
                  {enrichmentData.contact_profile.background_bullets && (
                    <div className="data-item">
                      <strong>Background:</strong>
                      <ul>
                        {enrichmentData.contact_profile.background_bullets.map((b: any, i: number) => (
                          <li key={i}>{b.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Company Profile */}
            {enrichmentData.company_profile && (
              <div className="subsection">
                <h3>🏢 Company Profile</h3>
                <div className="data-display">
                  {enrichmentData.company_profile.one_liner && (
                    <div className="data-item">
                      <strong>Overview:</strong> {enrichmentData.company_profile.one_liner}
                    </div>
                  )}
                  {enrichmentData.company_profile.industry && (
                    <div className="data-item">
                      <strong>Industry:</strong> {enrichmentData.company_profile.industry}
                    </div>
                  )}
                  {enrichmentData.company_profile.size_segment && (
                    <div className="data-item">
                      <strong>Size:</strong> {enrichmentData.company_profile.size_segment}
                    </div>
                  )}
                  {enrichmentData.company_profile.region && (
                    <div className="data-item">
                      <strong>Region:</strong> {enrichmentData.company_profile.region}
                    </div>
                  )}
                  {enrichmentData.company_profile.key_products_or_services && (
                    <div className="data-item">
                      <strong>Products/Services:</strong>
                      <ul>
                        {enrichmentData.company_profile.key_products_or_services.map((p: any, i: number) => (
                          <li key={i}>{p.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current Focus */}
            {enrichmentData.current_focus && (
              <div className="subsection">
                <h3>🎯 Current Focus</h3>
                <div className="data-display">
                  {enrichmentData.current_focus.strategic_initiatives && (
                    <div className="data-item">
                      <strong>Strategic Initiatives:</strong>
                      <ul>
                        {enrichmentData.current_focus.strategic_initiatives.map((i: any, idx: number) => (
                          <li key={idx}>{i.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.current_focus.recent_projects && (
                    <div className="data-item">
                      <strong>Recent Projects:</strong>
                      <ul>
                        {enrichmentData.current_focus.recent_projects.map((p: any, idx: number) => (
                          <li key={idx}>{p.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.current_focus.primary_kpis && (
                    <div className="data-item">
                      <strong>Primary KPIs:</strong>
                      <ul>
                        {enrichmentData.current_focus.primary_kpis.map((k: any, idx: number) => (
                          <li key={idx}>{k.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Buying Signals */}
            {enrichmentData.buying_signals && (
              <div className="subsection signal-box">
                <h3>🚀 Buying Signals</h3>
                <div className="data-display">
                  {enrichmentData.buying_signals.recent_news && (
                    <div className="data-item">
                      <strong>Recent News:</strong>
                      <ul>
                        {enrichmentData.buying_signals.recent_news.map((n: any, i: number) => (
                          <li key={i}>{n.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.buying_signals.timing_triggers && (
                    <div className="data-item">
                      <strong>Timing Triggers:</strong>
                      <ul>
                        {enrichmentData.buying_signals.timing_triggers.map((t: any, i: number) => (
                          <li key={i}>{t.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.buying_signals.hiring_signals && (
                    <div className="data-item">
                      <strong>Hiring Signals:</strong>
                      <ul>
                        {enrichmentData.buying_signals.hiring_signals.map((h: any, i: number) => (
                          <li key={i}>{h.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.buying_signals.tech_changes && (
                    <div className="data-item">
                      <strong>Tech Changes:</strong>
                      <ul>
                        {enrichmentData.buying_signals.tech_changes.map((t: any, i: number) => (
                          <li key={i}>{t.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Risks & Objections */}
            {enrichmentData.risks_and_objections && (
              <div className="subsection risk-box">
                <h3>⚠️ Risks & Objections</h3>
                <div className="data-display">
                  {enrichmentData.risks_and_objections.risk_bullets && (
                    <div className="data-item">
                      <strong>Risk Factors:</strong>
                      <ul>
                        {enrichmentData.risks_and_objections.risk_bullets.map((r: any, i: number) => (
                          <li key={i}>{r.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.risks_and_objections.likely_objections && (
                    <div className="data-item">
                      <strong>Likely Objections:</strong>
                      <ul>
                        {enrichmentData.risks_and_objections.likely_objections.map((o: any, i: number) => (
                          <li key={i}>{o.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.risks_and_objections.landmines && (
                    <div className="data-item">
                      <strong>Landmines:</strong>
                      <ul>
                        {enrichmentData.risks_and_objections.landmines.map((l: any, i: number) => (
                          <li key={i}>{l.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Messaging */}
            {enrichmentData.messaging && (
              <div className="subsection">
                <h3>💬 Messaging</h3>
                <div className="data-display">
                  {enrichmentData.messaging.cold_openers && (
                    <div className="data-item">
                      <strong>Cold Openers:</strong>
                      <ul>
                        {enrichmentData.messaging.cold_openers.map((c: any, i: number) => (
                          <li key={i}>{c.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.messaging.value_props && (
                    <div className="data-item">
                      <strong>Value Props:</strong>
                      <ul>
                        {enrichmentData.messaging.value_props.map((v: any, i: number) => (
                          <li key={i}>{v.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {enrichmentData.messaging.call_to_action_ideas && (
                    <div className="data-item">
                      <strong>Call-to-Action Ideas:</strong>
                      <ul>
                        {enrichmentData.messaging.call_to_action_ideas.map((c: any, i: number) => (
                          <li key={i}>{c.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            {enrichmentData.meta && (
              <div className="subsection meta-section">
                <h3>📊 Metadata</h3>
                <div className="data-display">
                  <div className="data-item">
                    <strong>Generated:</strong>{' '}
                    {enrichmentData.meta.generated_at
                      ? new Date(enrichmentData.meta.generated_at).toLocaleString()
                      : 'N/A'}
                  </div>
                  {enrichmentData.meta.source && (
                    <div className="data-item">
                      <strong>Source:</strong> {enrichmentData.meta.source}
                    </div>
                  )}
                  {enrichmentData.meta.model && (
                    <div className="data-item">
                      <strong>Model:</strong> {enrichmentData.meta.model}
                    </div>
                  )}
                  {enrichmentData.meta.provider && (
                    <div className="data-item">
                      <strong>Provider:</strong> {enrichmentData.meta.provider}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="section empty-section">
            <h2>Deep Enrichment</h2>
            <p>No enrichment data yet. Click the button above to generate.</p>
          </div>
        )}

        {/* Raw JSON (Dev View) */}
        {rawJson && (
          <div className="section">
            <details className="json-details">
              <summary>📄 Raw JSON Data</summary>
              <pre className="json-viewer">{rawJson}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};
