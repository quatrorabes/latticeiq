import React, { useState } from 'react';

interface CRMIntegration {
  id: number;
  crm_type: string;
  is_active: boolean;
  test_status: 'untested' | 'success' | 'failed';
  last_test_at?: string;
  last_sync_at?: string;
  import_filters: Record<string, any>;
  required_fields: Record<string, any>;
  auto_sync_enabled: boolean;
  sync_frequency_hours: number;
  api_key?: string;
  api_url?: string;
  created_at: string;
  updated_at: string;
}

interface CRM {
  id: string;
  name: string;
  icon: string;
  description: string;
  docs: string;
}

interface CRMIntegrationCardProps {
  crm: CRM;
  integration?: CRMIntegration;
  onUpdate: () => void;
  supabase: any;
}

const CRMIntegrationCard: React.FC<CRMIntegrationCardProps> = ({
  crm,
  integration,
  onUpdate,
  supabase
}) => {
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [autoSync, setAutoSync] = useState(integration?.auto_sync_enabled || false);
  const [syncFrequency, setSyncFrequency] = useState(integration?.sync_frequency_hours || 24);

  const getStatus = () => {
    if (!integration) return { color: 'gray', text: 'Not Connected' };
    if (integration.test_status === 'success' && integration.is_active) {
      return { color: 'green', text: '✓ Connected' };
    }
    if (integration.test_status === 'success') {
      return { color: 'yellow', text: '⚠ Tested, Not Active' };
    }
    return { color: 'red', text: '✗ Failed Test' };
  };

  const status = getStatus();

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      setMessage({ type: 'error', text: 'Please enter a valid API key' });
      return;
    }

    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const apiUrlBase = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

      const response = await fetch(`${apiUrlBase}/api/v3/settings/crm/integrations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          crm_type: crm.id,
          api_key: apiKey,
          api_url: apiUrl || undefined,
          import_filters: {
            exclude_lead_status: [],
            exclude_lifecycle_stage: [],
            exclude_dnc: true,
            exclude_unsubscribed: true,
            min_score_threshold: 0
          },
          required_fields: {
            must_have: ['first_name', 'company'],
            should_have: ['email', 'phone', 'linkedin_url']
          },
          auto_sync_enabled: autoSync,
          sync_frequency_hours: syncFrequency
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save credentials');
      }
      
      setMessage({ type: 'success', text: 'Credentials saved successfully' });
      setShowForm(false);
      setApiKey('');
      setApiUrl('');
      onUpdate();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setMessage({ type: 'error', text: 'Please enter a valid API key' });
      return;
    }

    try {
      setTesting(true);
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const apiUrlBase = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

      const response = await fetch(
        `${apiUrlBase}/api/v3/settings/crm/integrations/${crm.id}/test`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            crm_type: crm.id,
            api_key: apiKey,
            api_url: apiUrl || undefined
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Test failed');
      }

      const result = await response.json();
      setMessage({
        type: 'success',
        text: `✓ Connection successful! Found ${result.contact_count || 0} contacts`
      });
      onUpdate();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to disconnect ${crm.name}?`)) return;

    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const apiUrlBase = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

      const response = await fetch(
        `${apiUrlBase}/api/v3/settings/crm/integrations/${crm.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to delete');
      setMessage({ type: 'success', text: 'Integration disconnected' });
      onUpdate();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Deletion failed'
      });
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    gray: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{crm.icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-white">{crm.name}</h3>
            <p className="text-xs text-slate-400 mt-1">{crm.description}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status.color as keyof typeof statusColors]}`}>
          {status.text}
        </div>
      </div>

      {integration && (
        <div className="mb-4 p-3 bg-slate-700/30 rounded text-xs text-slate-300 space-y-1">
          {integration.last_test_at && (
            <div>Last test: {new Date(integration.last_test_at).toLocaleString()}</div>
          )}
          {integration.last_sync_at && (
            <div>Last sync: {new Date(integration.last_sync_at).toLocaleString()}</div>
          )}
          {integration.auto_sync_enabled && (
            <div>Auto-sync: Every {integration.sync_frequency_hours} hours</div>
          )}
        </div>
      )}

      {message && (
        <div
          className={`mb-4 p-3 rounded text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSaveCredentials} className="mb-4 p-4 bg-slate-700/30 rounded space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">API Key / Token *</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={`Enter your ${crm.name} API key`}
              required
            />
          </div>

          {crm.id === 'salesforce' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">API URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="https://your-instance.salesforce.com"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Enable auto-sync
          </label>

          {autoSync && (
            <div>
              <label className="text-xs text-slate-400">Sync frequency (hours):</label>
              <input
                type="number"
                min="1"
                max="168"
                value={syncFrequency}
                onChange={(e) => setSyncFrequency(parseInt(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white mt-1"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded transition"
            >
              {loading ? 'Saving...' : 'Save Credentials'}
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="flex-1 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded transition"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 pt-4 border-t border-slate-600">
        {!integration ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold py-2 px-3 rounded transition"
          >
            {showForm ? 'Cancel' : 'Connect'}
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold py-2 px-3 rounded transition"
            >
              {showForm ? 'Cancel' : 'Edit'}
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 text-red-400 text-sm font-semibold py-2 px-3 rounded transition border border-red-500/30"
            >
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CRMIntegrationCard;