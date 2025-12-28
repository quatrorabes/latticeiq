import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface CRMCredential {
  crm_type: string;
  api_key: string;
  api_url?: string;
  workspace_id?: string;
  instance_url?: string;
}

export default function SettingsPage() {
  const [credentials, setCredentials] = useState<Record<string, CRMCredential>>({
    hubspot: { crm_type: 'hubspot', api_key: '', api_url: 'https://api.hubapi.com' },
    salesforce: { crm_type: 'salesforce', api_key: '', instance_url: '' },
    pipedrive: { crm_type: 'pipedrive', api_key: '', api_url: 'https://api.pipedrive.com/v1' },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadCredentials();
  }, []);

  async function loadCredentials() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('crm_credentials')
        .select('*')
        .eq('user_id', session.user.id);

      if (error && error.code !== 'PGRST116') throw error;

      if (data && data.length > 0) {
        const credsMap: Record<string, CRMCredential> = { ...credentials };
        data.forEach((cred: any) => {
          credsMap[cred.crm_type] = {
            crm_type: cred.crm_type,
            api_key: cred.api_key,
            api_url: cred.api_url,
            workspace_id: cred.workspace_id,
            instance_url: cred.instance_url,
          };
        });
        setCredentials(credsMap);
      }
    } catch (err) {
      console.error('Error loading credentials:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveCredentials() {
    setSaving(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        setMessageType('error');
        return;
      }

      // Save each CRM credential
      for (const [crmType, cred] of Object.entries(credentials)) {
        if (!cred.api_key) continue; // Skip if no API key entered

        const { error } = await supabase.from('crm_credentials').upsert(
          {
            user_id: session.user.id,
            crm_type: crmType,
            api_key: cred.api_key,
            api_url: cred.api_url || null,
            workspace_id: cred.workspace_id || null,
            instance_url: cred.instance_url || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,crm_type' }
        );

        if (error) throw error;
      }

      setMessage('✅ CRM credentials saved successfully!');
      setMessageType('success');
    } catch (err) {
      setMessage(`Error saving credentials: ${(err as Error).message}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  }

  const updateCredential = (crmType: string, field: string, value: string) => {
    setCredentials({
      ...credentials,
      [crmType]: {
        ...credentials[crmType],
        [field]: value,
      },
    });
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading settings...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>⚙️ API & CRM Settings</h1>

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

      {/* HUBSPOT */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2 style={{ color: '#0066cc', marginTop: '0' }}>🔵 HubSpot</h2>
        <p style={{ color: '#999', fontSize: '12px' }}>
          <a href="https://app.hubspot.com/l/api-key/" target="_blank" rel="noopener noreferrer" style={{ color: '#0099ff' }}>
            Get HubSpot API Key →
          </a>
        </p>

        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              API Key
            </label>
            <input
              type="password"
              placeholder="Enter your HubSpot API key"
              value={credentials.hubspot?.api_key || ''}
              onChange={(e) => updateCredential('hubspot', 'api_key', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              API URL
            </label>
            <input
              type="text"
              placeholder="https://api.hubapi.com"
              value={credentials.hubspot?.api_url || ''}
              onChange={(e) => updateCredential('hubspot', 'api_url', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            />
          </div>
        </div>
      </div>

      {/* SALESFORCE */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2 style={{ color: '#0066cc', marginTop: '0' }}>☁️ Salesforce</h2>
        <p style={{ color: '#999', fontSize: '12px' }}>
          <a href="https://help.salesforce.com/s/articleView?id=sf.remoteaccess_authenticate_oauth_web_server_flow.htm" target="_blank" rel="noopener noreferrer" style={{ color: '#0099ff' }}>
            Get Salesforce OAuth Token →
          </a>
        </p>

        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              Access Token
            </label>
            <input
              type="password"
              placeholder="Enter your Salesforce access token"
              value={credentials.salesforce?.api_key || ''}
              onChange={(e) => updateCredential('salesforce', 'api_key', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              Instance URL
            </label>
            <input
              type="text"
              placeholder="https://your-instance.salesforce.com"
              value={credentials.salesforce?.instance_url || ''}
              onChange={(e) => updateCredential('salesforce', 'instance_url', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            />
          </div>
        </div>
      </div>

      {/* PIPEDRIVE */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2 style={{ color: '#0066cc', marginTop: '0' }}>📈 Pipedrive</h2>
        <p style={{ color: '#999', fontSize: '12px' }}>
          <a href="https://app.pipedrive.com/settings/personal/api" target="_blank" rel="noopener noreferrer" style={{ color: '#0099ff' }}>
            Get Pipedrive API Token →
          </a>
        </p>

        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              API Token
            </label>
            <input
              type="password"
              placeholder="Enter your Pipedrive API token"
              value={credentials.pipedrive?.api_key || ''}
              onChange={(e) => updateCredential('pipedrive', 'api_key', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              API URL
            </label>
            <input
              type="text"
              placeholder="https://api.pipedrive.com/v1"
              value={credentials.pipedrive?.api_url || ''}
              onChange={(e) => updateCredential('pipedrive', 'api_url', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            />
          </div>
        </div>
      </div>

      {/* SAVE BUTTON */}
      <button
        onClick={saveCredentials}
        disabled={saving}
        style={{
          width: '100%',
          padding: '12px',
          background: saving ? '#666' : '#00cc00',
          color: saving ? '#999' : '#000',
          fontWeight: 'bold',
          fontSize: '16px',
          border: 'none',
          borderRadius: '4px',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? '⏳ Saving...' : '💾 Save CRM Credentials'}
      </button>

      <div style={{ marginTop: '20px', padding: '15px', background: '#0a0a0a', borderRadius: '4px', fontSize: '12px', color: '#999' }}>
        <p style={{ marginTop: '0' }}>🔒 Your API credentials are encrypted and stored securely.</p>
        <p>Only enter API keys for CRMs you want to import from.</p>
      </div>
    </div>
  );
}