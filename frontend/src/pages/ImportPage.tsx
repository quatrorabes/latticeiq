import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ImportPage() {
  const [importType, setImportType] = useState<'csv' | 'hubspot' | 'salesforce' | 'pipedrive'>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  async function handleImport() {
    setLoading(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        setMessageType('error');
        setLoading(false);
        return;
      }

      const token = session.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

      if (importType === 'csv' && csvFile) {
        // CSV Import
        const formData = new FormData();
        formData.append('file', csvFile);

        const response = await fetch(`${apiUrl}/api/import/csv`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          setMessage(`Import failed: ${result.detail || response.statusText}`);
          setMessageType('error');
        } else {
          setMessage(`✅ Imported ${result.imported_count || 0} contacts from CSV`);
          setMessageType('success');
          setCsvFile(null);
        }
      } else {
        // CRM Import (HubSpot, Salesforce, Pipedrive)
        const response = await fetch(
          `${apiUrl}/api/import/${importType}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json();

        if (!response.ok) {
          setMessage(`Import failed: ${result.detail || response.statusText}`);
          setMessageType('error');
        } else {
          setMessage(`✅ Started ${importType.toUpperCase()} import. Check back in a few minutes.`);
          setMessageType('success');
        }
      }
    } catch (err) {
      setMessage(`Error: ${(err as Error).message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Import Contacts</h1>

      {/* MESSAGE */}
      {message && (
        <div
          style={{
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px',
            background: messageType === 'success' ? '#003300' : '#330000',
            color: messageType === 'success' ? '#00ff00' : '#ff0000',
            border: `1px solid ${messageType === 'success' ? '#00ff00' : '#ff0000'}`,
          }}
        >
          {message}
        </div>
      )}

      {/* IMPORT TYPE SELECTOR */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          Import Source
        </label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { value: 'csv', label: '📄 CSV File' },
            { value: 'hubspot', label: '🔵 HubSpot' },
            { value: 'salesforce', label: '☁️ Salesforce' },
            { value: 'pipedrive', label: '📊 Pipedrive' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setImportType(option.value as any)}
              style={{
                padding: '10px 15px',
                background: importType === option.value ? '#0066cc' : '#444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: importType === option.value ? 'bold' : 'normal',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* CSV FILE UPLOAD */}
      {importType === 'csv' && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            Select CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            style={{
              display: 'block',
              padding: '10px',
              width: '100%',
              borderRadius: '4px',
              border: '1px solid #444',
              background: '#1a1a1a',
              color: '#fff',
            }}
          />
          <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>
            ℹ️ CSV must have columns: first_name, last_name, email, company (optional)
          </p>
        </div>
      )}

      {/* CRM INFO */}
      {importType !== 'csv' && (
        <div
          style={{
            padding: '12px',
            background: '#1a1a1a',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#999',
            border: '1px solid #444',
          }}
        >
          <p style={{ margin: '0 0 8px 0' }}>
            ⚠️ Make sure you have configured {importType.toUpperCase()} credentials in Settings
          </p>
          <p style={{ margin: '0' }}>
            We'll fetch all contacts from your {importType.toUpperCase()} account and add them here.
          </p>
        </div>
      )}

      {/* IMPORT BUTTON */}
      <button
        onClick={handleImport}
        disabled={loading || (importType === 'csv' && !csvFile)}
        style={{
          width: '100%',
          padding: '12px',
          background: loading || (importType === 'csv' && !csvFile) ? '#666' : '#00cc00',
          color: loading || (importType === 'csv' && !csvFile) ? '#999' : '#000',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '4px',
          cursor: loading || (importType === 'csv' && !csvFile) ? 'not-allowed' : 'pointer',
          fontSize: '16px',
        }}
      >
        {loading ? '⏳ Importing...' : '📤 Import Contacts'}
      </button>

      {/* INSTRUCTIONS */}
      <div style={{ marginTop: '30px', padding: '15px', background: '#1a1a1a', borderRadius: '4px', fontSize: '12px' }}>
        <h3 style={{ marginTop: '0', color: '#0066cc' }}>📋 Instructions</h3>

        <h4>CSV Format:</h4>
        <pre
          style={{
            background: '#0a0a0a',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '11px',
          }}
        >
          {`first_name,last_name,email,company,title,phone,linkedin_url
John,Doe,john@example.com,Acme Corp,CEO,555-1234,https://linkedin.com/in/johndoe
Jane,Smith,jane@example.com,Tech Inc,VP Sales,555-5678,https://linkedin.com/in/janesmith`}
        </pre>

        <h4>CRM Setup:</h4>
        <ol style={{ marginLeft: '20px' }}>
          <li>Go to Settings</li>
          <li>Add your CRM credentials (API key, etc.)</li>
          <li>Come back here and click Import</li>
        </ol>
      </div>
    </div>
  );
}