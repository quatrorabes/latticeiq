import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';

interface Contact {
  [key: string]: any;
}

interface Props {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrichComplete: () => void;
}

export default function ContactDetailModal({
  contact,
  isOpen,
  onClose,
  onEnrichComplete,
}: Props) {
  const [enriching, setEnriching] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<any>(null);

  if (!isOpen || !contact) return null;

  async function handleEnrich() {
    setEnriching(true);
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        alert('Not authenticated. Please login first.');
        setEnriching(false);
        return;
      }

      const token = session.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

      console.log('=== ENRICH REQUEST ===');
      console.log('Contact ID:', contact?.id);
      console.log('Token:', token.slice(0, 20) + '...');
      console.log('API URL:', apiUrl);

      const response = await fetch(
        `${apiUrl}/api/v3/enrich/${contact?.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('Response Status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Enrich error:', errorText);
        setEnrichmentResult({ error: `${response.status}: ${errorText}` });
        
        // Mark as failed
        await supabase
          .from('contacts')
          .update({ enrichment_status: 'failed' })
          .eq('id', contact?.id);
        
        setEnriching(false);
        return;
      }

      const result = await response.json();
      console.log('=== ENRICHMENT RESULT ===');
      console.log(result);
      
      // Mark as enriched and save result
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ 
          enrichment_status: 'enriched',
          enrichment_data: result.enrichment_data || result,
          apex_score: result.apex_score || null,
        })
        .eq('id', contact?.id);

      if (updateError) {
        console.error('Error updating contact status:', updateError);
        setEnrichmentResult({ error: `Failed to save enrichment: ${updateError.message}` });
      } else {
        setEnrichmentResult(result);
        alert('✅ Enrichment complete!');
      }
      
      onEnrichComplete();
    } catch (err) {
      console.error('Error enriching:', err);
      setEnrichmentResult({ error: (err as Error).message });
      alert('Error enriching contact: ' + (err as Error).message);
    } finally {
      setEnriching(false);
    }
  }

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#2a2a2a',
    border: '2px solid #0066cc',
    borderRadius: '8px',
    padding: '20px',
    maxWidth: '900px',
    width: '95%',
    maxHeight: '90vh',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    color: '#fff',
  };

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: 999,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
    borderBottom: '1px solid #444',
    paddingBottom: '15px',
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 'bold',
    color: '#0066cc',
    marginTop: '10px',
    marginBottom: '5px',
    fontSize: '12px',
    textTransform: 'uppercase',
  };

  const valueStyle: React.CSSProperties = {
    padding: '8px',
    background: '#1a1a1a',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '14px',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    lineHeight: '1.6',
  };

  const jsonStyle: React.CSSProperties = {
    background: '#0a0a0a',
    padding: '15px',
    borderRadius: '4px',
    marginTop: '10px',
    fontSize: '11px',
    fontFamily: 'monospace',
    maxHeight: '300px',
    overflowY: 'auto',
    border: '1px solid #444',
    color: '#0f0',
  };

  // Extract enrichment data
  const enrichmentData = contact.enrichment_data || {};
  const {
    summary = '',
    company_overview = '',
    talking_points = [],
    inferred_title = '',
    inferred_seniority = '',
    persona_type = '',
    vertical = '',
    company_size = '',
    recent_news = '',
    recommended_approach = '',
  } = enrichmentData;

  return createPortal(
    <>
      <div style={backdropStyle} onClick={onClose} />
      <div style={modalStyle}>
        
        {/* HEADER */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0' }}>
            {contact.first_name} {contact.last_name}
          </h2>
          <p style={{ margin: '0', color: '#0066cc', fontSize: '12px' }}>
            ID: {contact.id}
          </p>
        </div>

        {/* BASIC CONTACT INFO */}
        <div style={sectionStyle}>
          <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
            📋 Contact Information
          </h3>
          
          <div>
            <div style={labelStyle}>Email</div>
            <div style={valueStyle}>{contact.email || '(empty)'}</div>
          </div>

          <div>
            <div style={labelStyle}>Company</div>
            <div style={valueStyle}>{contact.company || '(empty)'}</div>
          </div>

          <div>
            <div style={labelStyle}>Job Title</div>
            <div style={valueStyle}>{contact.title || '(empty)'}</div>
          </div>

          <div>
            <div style={labelStyle}>Phone</div>
            <div style={valueStyle}>{contact.phone || '(empty)'}</div>
          </div>

          <div>
            <div style={labelStyle}>LinkedIn URL</div>
            <div style={valueStyle}>
              {contact.linkedin_url ? (
                <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#0099ff' }}>
                  {contact.linkedin_url}
                </a>
              ) : (
                '(empty)'
              )}
            </div>
          </div>
        </div>

        {/* ENRICHMENT STATUS */}
        <div style={sectionStyle}>
          <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
            🎯 Enrichment Status
          </h3>

          <div>
            <div style={labelStyle}>Status</div>
            <div style={{
              padding: '8px',
              borderRadius: '4px',
              background: contact.enrichment_status === 'enriched' ? '#003300' : '#663300',
              color: contact.enrichment_status === 'enriched' ? '#00ff00' : '#ffcc00',
              display: 'inline-block',
              fontWeight: 'bold',
            }}>
              {contact.enrichment_status || 'pending'}
            </div>
          </div>

          {contact.apex_score && (
            <div>
              <div style={labelStyle}>APEX Score</div>
              <div style={{ ...valueStyle, color: '#00ff00', fontWeight: 'bold', fontSize: '18px' }}>
                {Math.round(contact.apex_score)}/100
              </div>
            </div>
          )}
        </div>

        {/* INFERRED PROFILE */}
        {(inferred_title || inferred_seniority || persona_type || vertical || company_size) && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
              👤 Inferred Profile
            </h3>

            {inferred_title && (
              <div>
                <div style={labelStyle}>Inferred Title</div>
                <div style={valueStyle}>{inferred_title}</div>
              </div>
            )}

            {inferred_seniority && (
              <div>
                <div style={labelStyle}>Seniority Level</div>
                <div style={valueStyle}>{inferred_seniority}</div>
              </div>
            )}

            {persona_type && (
              <div>
                <div style={labelStyle}>Persona Type</div>
                <div style={valueStyle}>{persona_type}</div>
              </div>
            )}

            {vertical && (
              <div>
                <div style={labelStyle}>Vertical / Industry</div>
                <div style={valueStyle}>{vertical}</div>
              </div>
            )}

            {company_size && (
              <div>
                <div style={labelStyle}>Company Size</div>
                <div style={valueStyle}>{company_size}</div>
              </div>
            )}
          </div>
        )}

        {/* PROFESSIONAL SUMMARY */}
        {summary && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
              📝 Professional Summary
            </h3>
            <div style={valueStyle}>{summary}</div>
          </div>
        )}

        {/* COMPANY OVERVIEW */}
        {company_overview && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
              🏢 Company Overview
            </h3>
            <div style={valueStyle}>{company_overview}</div>
          </div>
        )}

        {/* TALKING POINTS */}
        {talking_points.length > 0 && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
              💬 Conversation Starters
            </h3>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              {talking_points.map((point: string, idx: number) => (
                <li key={idx} style={{ marginBottom: '12px', lineHeight: '1.6' }}>
                  <span style={{ color: '#fff' }}>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* RECENT NEWS */}
        {recent_news && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
              📰 Recent News & Activity
            </h3>
            <div style={valueStyle}>{recent_news}</div>
          </div>
        )}

        {/* RECOMMENDED APPROACH */}
        {recommended_approach && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
              🎯 Recommended Sales Approach
            </h3>
            <div style={valueStyle}>{recommended_approach}</div>
          </div>
        )}

        {/* ENRICHMENT ERROR */}
        {enrichmentResult?.error && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#ff0000', fontSize: '16px', margin: '0 0 15px 0' }}>
              ❌ Enrichment Error
            </h3>
            <div style={{ ...valueStyle, color: '#ff6666' }}>
              {enrichmentResult.error}
            </div>
          </div>
        )}

        {/* RAW JSON (DEBUG) */}
        {enrichmentData && Object.keys(enrichmentData).length > 0 && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0' }}>
              🔧 Raw Enrichment JSON
            </h3>
            <pre style={jsonStyle}>
              {JSON.stringify(enrichmentData, null, 2)}
            </pre>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleEnrich}
              disabled={enriching}
              style={{
                padding: '10px 20px',
                background: enriching ? '#666' : '#00cc00',
                color: '#000',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '4px',
                cursor: enriching ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {enriching ? '⏳ Enriching...' : '✨ Re-Enrich'}
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Close
          </button>
        </div>

      </div>
    </>,
    document.body
  );
}