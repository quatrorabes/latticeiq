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
        setEnriching(false);
        return;
      }

      const result = await response.json();
      console.log('=== ENRICHMENT RESULT ===');
      console.log(result);
      
      setEnrichmentResult(result);
      onEnrichComplete();
      alert('Enrichment complete!');
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
    maxWidth: '800px',
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

  // Get all contact fields
  const getFieldValue = (key: string) => {
    const val = contact[key];
    if (val === null) return '(null)';
    if (val === undefined) return '(undefined)';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const contactKeys = Object.keys(contact).sort();

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

        {/* CONTACT BASICS */}
        <div style={sectionStyle}>
          <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
            📋 Contact Details
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
            <div style={valueStyle}>{contact.linkedin_url || '(empty)'}</div>
          </div>

          <div>
            <div style={labelStyle}>Website</div>
            <div style={valueStyle}>{contact.website || '(empty)'}</div>
          </div>

          <div>
            <div style={labelStyle}>Vertical</div>
            <div style={valueStyle}>{contact.vertical || '(empty)'}</div>
          </div>

          <div>
            <div style={labelStyle}>Persona Type</div>
            <div style={valueStyle}>{contact.persona_type || '(empty)'}</div>
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
              background: contact.enrichment_status === 'completed' ? '#003300' : '#663300',
              color: contact.enrichment_status === 'completed' ? '#00ff00' : '#ffcc00',
            }}>
              {contact.enrichment_status || 'pending'}
            </div>
          </div>

          <div style={{ marginTop: '15px' }}>
            <div style={labelStyle}>Last Enriched</div>
            <div style={valueStyle}>{contact.enriched_at || '(never)'}</div>
          </div>
        </div>

        {/* SCORES */}
        <div style={sectionStyle}>
          <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
            📊 Scores
          </h3>

          <div>
            <div style={labelStyle}>APEX Score</div>
            <div style={{
              ...valueStyle,
              fontSize: '18px',
              fontWeight: 'bold',
              color: contact.apex_score ? '#00ff00' : '#666',
            }}>
              {contact.apex_score || '(not calculated)'}
            </div>
          </div>

          <div>
            <div style={labelStyle}>MDCP Score</div>
            <div style={valueStyle}>{contact.mdcp_score || '(not calculated)'}</div>
          </div>

          <div>
            <div style={labelStyle}>BANT Score</div>
            <div style={valueStyle}>{contact.bant_score || '(not calculated)'}</div>
          </div>

          <div>
            <div style={labelStyle}>SPICE Score</div>
            <div style={valueStyle}>{contact.spice_score || '(not calculated)'}</div>
          </div>
        </div>

        {/* ENRICHMENT DATA */}
        {contact.enrichment_data && (
          <div style={sectionStyle}>
            <h3 style={{ color: '#0066cc', fontSize: '16px', margin: '0 0 15px 0' }}>
              ✨ Enrichment Data
            </h3>
            <pre style={jsonStyle}>
              {JSON.stringify(contact.enrichment_data, null, 2)}
            </pre>
          </div>
        )}

        {/* ENRICHMENT RESULT FROM LAST REQUEST */}
        {enrichmentResult && (
          <div style={sectionStyle}>
            <h3 style={{ color: enrichmentResult.error ? '#ff0000' : '#00ff00', fontSize: '16px', margin: '0 0 15px 0' }}>
              {enrichmentResult.error ? '❌ Last Enrichment Error' : '✅ Last Enrichment Result'}
            </h3>
            <pre style={jsonStyle}>
              {JSON.stringify(enrichmentResult, null, 2)}
            </pre>
          </div>
        )}

        {/* ALL FIELDS (DEBUG) */}
        <div style={sectionStyle}>
          <h3 style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0' }}>
            🔧 All Fields (Raw)
          </h3>
          <div style={jsonStyle}>
            {contactKeys.map((key) => (
              <div key={key} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                <span style={{ color: '#00ff00' }}>{key}</span>
                <span style={{ color: '#666' }}>: </span>
                <span style={{ color: '#ffff00' }}>{getFieldValue(key)}</span>
              </div>
            ))}
          </div>
        </div>

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