import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CRMIntegration {
  id: string;
  user_id: string;
  crm_type: 'hubspot' | 'salesforce' | 'pipedrive';
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ImportStatus {
  status: 'idle' | 'importing' | 'success' | 'error';
  message: string;
  contacts_imported?: number;
  error?: string;
}

export default function SettingsPage() {
  // State
  const [integrations, setIntegrations] = useState<CRMIntegration[]>([]);
  const [crmType, setCrmType] = useState<'hubspot' | 'salesforce' | 'pipedrive'>('hubspot');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importStatus, setImportStatus] = useState<ImportStatus>({ status: 'idle', message: '' });
  const [selectedCRM, setSelectedCRM] = useState<string>('');

  // Load integrations on mount
  useEffect(() => {
    fetchIntegrations();
  }, []);

  // Fetch saved CRM integrations with improved token handling
  const fetchIntegrations = async () => {
    try {
      // Get session from Supabase
      const { data, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setError('Failed to get session');
        return;
      }

      const token = data?.session?.access_token;
      
      if (!token) {
        console.warn('No token found. User may not be logged in.');
        setError('Not authenticated. Please log in first.');
        return;
      }

      console.debug('Fetching integrations with token:', token.substring(0, 20) + '...');

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/settings/crm/integrations`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.debug('Fetch response status:', res.status);

      if (res.status === 401) {
        setError('Session expired. Please log out and log back in.');
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      const data_resp = await res.json();
      console.debug('Fetched integrations:', data_resp);
      setIntegrations(Array.isArray(data_resp) ? data_resp : []);
    } catch (err) {
      console.error('fetchIntegrations error:', err);
      setError(`Failed to load integrations: ${String(err)}`);
    }
  };

  // Save or update CRM integration
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/settings/crm/integrations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            crm_type: crmType,
            api_key: apiKey,
            is_active: true,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to save integration');
      }

      setApiKey('');
      await fetchIntegrations();
      setError('');
    } catch (err) {
      setError(`Save failed: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Test CRM connection
  const handleTest = async (type: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const integration = integrations.find((i) => i.crm_type === type);
      if (!integration) {
        throw new Error('Integration not found');
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/settings/crm/integrations/${type}/test`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            api_key: integration.api_key,
          }),
        }
      );

      const result = await res.json();
      if (res.ok) {
        alert(`✅ ${type.toUpperCase()} connection successful!\n${result.message}`);
      } else {
        alert(`❌ Connection failed: ${result.detail || result.message}`);
      }
    } catch (err) {
      alert(`Test error: ${String(err)}`);
    }
  };

  // Delete CRM integration
  const handleDelete = async (type: string) => {
    if (!confirm(`Delete ${type.toUpperCase()} integration? This cannot be undone.`)) {
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/settings/crm/integrations/${type}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to delete integration: ${res.status}`);
      }

      await fetchIntegrations();
    } catch (err) {
      setError(`Delete failed: ${String(err)}`);
    }
  };

  // Import contacts from CRM
  const handleImport = async (type: string) => {
    const integration = integrations.find((i) => i.crm_type === type);
    if (!integration) {
      setError(`${type.toUpperCase()} integration not configured`);
      return;
    }

    setSelectedCRM(type);
    setImportStatus({ status: 'importing', message: `Importing ${type.toUpperCase()} contacts...` });

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        throw new Error('Not authenticated. Please log in first.');
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/v3/crm/import/${type}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        throw new Error(
          'Authentication failed. Your session may have expired. Please log out and log back in.'
        );
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.detail || errData.error || `Import failed with status ${res.status}`
        );
      }

      const result = await res.json();
      setImportStatus({
        status: 'success',
        message: `✅ Successfully imported ${result.contacts_imported || result.count || '?'} contacts from ${type.toUpperCase()}!`,
        contacts_imported: result.contacts_imported || result.count,
      });
    } catch (err) {
      setImportStatus({
        status: 'error',
        message: `❌ Import failed`,
        error: String(err),
      });
    } finally {
      setSelectedCRM('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">CRM Settings</h1>
          <p className="text-slate-400">Configure and manage your CRM integrations</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-200 p-4 rounded-lg mb-6">
            <p className="font-medium">⚠️ Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Import Status Alert */}
        {importStatus.status !== 'idle' && (
          <div
            className={`border p-4 rounded-lg mb-6 ${
              importStatus.status === 'success'
                ? 'bg-green-900/20 border-green-500/30 text-green-200'
                : importStatus.status === 'error'
                ? 'bg-red-900/20 border-red-500/30 text-red-200'
                : 'bg-blue-900/20 border-blue-500/30 text-blue-200'
            }`}
          >
            <p className="font-medium">{importStatus.message}</p>
            {importStatus.error && <p className="text-sm mt-2">{importStatus.error}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add/Edit Integration Form */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl">
              <h2 className="text-2xl font-bold text-white mb-6">Add New Integration</h2>

              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    CRM Platform
                  </label>
                  <select
                    value={crmType}
                    onChange={(e) => setCrmType(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="hubspot">HubSpot</option>
                    <option value="salesforce">Salesforce</option>
                    <option value="pipedrive">Pipedrive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    API Key / Access Token
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your API key here"
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    🔒 Your API key is encrypted and never shared
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !apiKey}
                  className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-all"
                >
                  {loading ? '💾 Saving...' : '💾 Save Integration'}
                </button>
              </form>
            </div>
          </div>

          {/* Saved Integrations */}
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl h-fit">
            <h3 className="text-lg font-bold text-white mb-4">📊 Integrations</h3>
            {integrations.length === 0 ? (
              <p className="text-slate-400 text-sm">No integrations configured yet</p>
            ) : (
              <div className="space-y-2">
                {integrations.map((int) => (
                  <div key={int.id} className="text-sm text-slate-300">
                    ✅ {int.crm_type.toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Integration Cards */}
        {integrations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">Manage Integrations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="bg-slate-800/50 border border-slate-700 p-5 rounded-xl"
                >
                  <h3 className="text-lg font-bold text-white mb-4">
                    {integration.crm_type.toUpperCase()}
                  </h3>

                  <div className="space-y-2">
                    <button
                      onClick={() => handleImport(integration.crm_type)}
                      disabled={selectedCRM === integration.crm_type}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-all"
                    >
                      {selectedCRM === integration.crm_type ? '⏳ Importing...' : '📥 Import Now'}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTest(integration.crm_type)}
                        className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-medium py-1.5 rounded-lg text-sm transition-all"
                      >
                        🔗 Test
                      </button>
                      <button
                        onClick={() => handleDelete(integration.crm_type)}
                        className="bg-red-600/20 hover:bg-red-600/30 text-red-300 font-medium py-1.5 rounded-lg text-sm transition-all"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
