import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SettingsPage() {
  const [crms, setCrms] = useState({
    hubspot: { api_key: '', is_configured: false },
    salesforce: { api_key: '', is_configured: false },
    pipedrive: { api_key: '', is_configured: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('crm_credentials')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;

      const newCrms = { ...crms };
      data?.forEach((cred: any) => {
        if (newCrms[cred.crm_type as keyof typeof crms]) {
          newCrms[cred.crm_type as keyof typeof crms] = {
            api_key: cred.api_key || '',
            is_configured: !!cred.api_key,
          };
        }
      });
      setCrms(newCrms);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(crmType: keyof typeof crms) {
    setSaving(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        setMessageType('error');
        return;
      }

      const { error } = await supabase.from('crm_credentials').upsert(
        {
          user_id: session.user.id,
          crm_type: crmType,
          api_key: crms[crmType].api_key,
        },
        { onConflict: 'user_id,crm_type' }
      );

      if (error) throw error;

      setCrms({
        ...crms,
        [crmType]: { ...crms[crmType], is_configured: !!crms[crmType].api_key },
      });

      setMessage(`✅ ${crmType.toUpperCase()} credentials saved!`);
      setMessageType('success');
    } catch (err) {
      setMessage(`Error saving credentials: ${(err as Error).message}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCredentials(crmType: keyof typeof crms) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from('crm_credentials')
        .delete()
        .eq('user_id', session.user.id)
        .eq('crm_type', crmType);

      setCrms({
        ...crms,
        [crmType]: { api_key: '', is_configured: false },
      });

      setMessage(`✅ ${crmType.toUpperCase()} credentials deleted`);
      setMessageType('success');
    } catch (err) {
      setMessage(`Error deleting credentials: ${(err as Error).message}`);
      setMessageType('error');
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading settings...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>⚙️ Settings</h1>

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

      {/* CRM INTEGRATIONS */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#0066cc', marginBottom: '20px' }}>🔗 CRM Integrations</h2>

        {[
          {
            key: 'hubspot',
            label: 'HubSpot',
            icon: '🔵',
            docs: 'https://developers.hubspot.com/docs/api/private-apps',
          },
          {
            key: 'salesforce',
            label: 'Salesforce',
            icon: '☁️',
            docs: 'https://help.salesforce.com/s/articleView?id=sf.connected_app_overview.htm',
          },
          {
            key: 'pipedrive',
            label: 'Pipedrive',
            icon: '📊',
            docs: 'https://developers.pipedrive.com/docs/basics/authentication',
          },
        ].map((crm) => (
          <div
            key={crm.key}
            style={{
              padding: '20px',
              background: '#1a1a1a',
              borderRadius: '8px',
              marginBottom: '15px',
              border: crms[crm.key as keyof typeof crms].is_configured
                ? '2px solid #00ff00'
                : '1px solid #444',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: '0', color: '#0066cc' }}>
                {crm.icon} {crm.label}
              </h3>
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  background: crms[crm.key as keyof typeof crms].is_configured ? '#003300' : '#663300',
                  color: crms[crm.key as keyof typeof crms].is_configured ? '#00ff00' : '#ffcc00',
                }}
              >
                {crms[crm.key as keyof typeof crms].is_configured ? '✅ Configured' : '⚠️ Not Configured'}
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}>
                API Key / Token
              </label>
              <input
                type="password"
                placeholder={`Enter ${crm.label} API Key`}
                value={crms[crm.key as keyof typeof crms].api_key}
                onChange={(e) =>
                  setCrms({
                    ...crms,
                    [crm.key]: { ...crms[crm.key as keyof typeof crms], api_key: e.target.value },
                  })
                }
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  background: '#0a0a0a',
                  color: '#fff',
                  fontFamily: 'monospace',
                }}
              />
              <a
                href={crm.docs}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '11px',
                  color: '#0099ff',
                  marginTop: '5px',
                  display: 'block',
                }}
              >
                📖 {crm.label} API Documentation
              </a>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => saveSettings(crm.key as keyof typeof crms)}
                disabled={saving || !crms[crm.key as keyof typeof crms].api_key}
                style={{
                  padding: '10px 15px',
                  background:
                    saving || !crms[crm.key as keyof typeof crms].api_key ? '#666' : '#00cc00',
                  color: saving || !crms[crm.key as keyof typeof crms].api_key ? '#999' : '#000',
                  fontWeight: 'bold',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: saving || !crms[crm.key as keyof typeof crms].api_key ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? '⏳ Saving...' : '💾 Save'}
              </button>

              {crms[crm.key as keyof typeof crms].is_configured && (
                <button
                  onClick={() => deleteCredentials(crm.key as keyof typeof crms)}
                  style={{
                    padding: '10px 15px',
                    background: '#cc0000',
                    color: 'white',
                    fontWeight: 'bold',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  🗑️ Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* DATABASE SCHEMA INFO */}
      <div style={{ marginBottom: '30px', padding: '15px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h3 style={{ color: '#0066cc', marginTop: '0' }}>📝 Notes</h3>
        <ul style={{ fontSize: '12px', color: '#999' }}>
          <li>Your API keys are encrypted and stored securely in Supabase</li>
          <li>We only use these keys to import contacts with your permission</li>
          <li>You can remove any integration at any time</li>
          <li>After adding credentials, go to Import to start syncing contacts</li>
        </ul>
      </div>
    </div>
  );
}