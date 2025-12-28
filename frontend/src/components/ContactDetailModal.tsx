import { useState } from 'react';
import { createPortal } from 'react-dom';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  enrichment_status: string;
  enrichment_data: any;
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

  if (!isOpen || !contact) return null;

  async function handleEnrich() {
    setEnriching(true);
    try {
      const { data: sessionData } = await (window as any).__supabase?.auth?.getSession?.();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/enrich/${contact?.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Enrichment failed');

      onEnrichComplete();
      alert('Enrichment complete!');
    } catch (err) {
      console.error('Error enriching:', err);
      alert('Error enriching contact');
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
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '20px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
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

  const contentStyle: React.CSSProperties = {
    marginBottom: '15px',
  };

  const enrichmentDataStyle: React.CSSProperties = {
    background: '#1a1a1a',
    padding: '15px',
    borderRadius: '4px',
    marginTop: '15px',
    fontSize: '12px',
    fontFamily: 'monospace',
    maxHeight: '300px',
    overflowY: 'auto',
  };

  return createPortal(
    <>
      <div style={backdropStyle} onClick={onClose} />
      <div style={modalStyle}>
        <h2>
          {contact.first_name} {contact.last_name}
        </h2>
        <div style={contentStyle}>
          <strong>Email:</strong> {contact.email}
        </div>
        <div style={contentStyle}>
          <strong>Company:</strong> {contact.company || '-'}
        </div>
        <div style={contentStyle}>
          <strong>Status:</strong>{' '}
          <span
            style={{
              display: 'inline-block',
              padding: '4px 8px',
              borderRadius: '4px',
              background: contact.enrichment_status === 'completed' ? '#00cc00' : '#ff6600',
              color: 'white',
              fontSize: '12px',
            }}
          >
            {contact.enrichment_status || 'pending'}
          </span>
        </div>

        {contact.enrichment_data && (
          <div style={enrichmentDataStyle}>
            <strong>Enrichment Data:</strong>
            <pre>{JSON.stringify(contact.enrichment_data, null, 2)}</pre>
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            style={{
              padding: '10px 20px',
              background: enriching ? '#666' : '#00cc00',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: enriching ? 'not-allowed' : 'pointer',
            }}
          >
            {enriching ? 'Enriching...' : 'Re-Enrich'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
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
