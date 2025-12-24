import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Integration {
  id: string;
  user_id: string;
  crm_type: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [crmType, setCrmType] = useState('hubspot');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testingCRM, setTestingCRM] = useState<string | null>(null);
  const [importingCRM, setImportingCRM] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const getAuthToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchIntegrations = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${apiUrl}/api/v3/settings/crm/integrations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setIntegrations(data.integrations || []);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${apiUrl}/api/v3/settings/crm/integrations`, {
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
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || 'Failed');
        return;
      }

      setSuccess(`${crmType.toUpperCase()} saved!`);
      setApiKey('');
      fetchIntegrations();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (type: string) => {
    setTestingCRM(type);
    try {
      const token = await getAuthToken();
      const res = await fetch(
        `${apiUrl}/api/v3/settings/crm/integrations/${type}/test`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Test failed');
      const data = await res.json();
      setSuccess(data.message || 'Connection successful!');
    } catch (err) {
      setError(String(err));
    } finally {
      setTestingCRM(null);
    }
  };

  const handleImportContacts = async (integration: Integration) => {
    setImportingCRM(integration.crm_type);
    try {
      const token = await getAuthToken();
      
      // FIX: No body parameter - backend reads API key from crm_integrations table
      const res = await fetch(
        `${apiUrl}/api/v3/crm/import/${integration.crm_type}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          // NO BODY - backend reads from database automatically
        }
      );

      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || 'Import failed');
        return;
      }

      const data = await res.json();
      setSuccess(`Import started! Job ID: ${data.job_id}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setImportingCRM(null);
    }
  };

  const handleDelete = async (type: string) => {
    if (!confirm(`Delete ${type}?`)) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(
        `${apiUrl}/api/v3/settings/crm/integrations/${type}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Delete failed');
      setSuccess(`${type.toUpperCase()} deleted!`);
      fetchIntegrations();
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">CRM Settings</h1>

      {error && <div className="bg-red-50 p-4 mb-6 rounded border-l-4 border-red-500">{error}</div>}
      {success && <div className="bg-green-50 p-4 mb-6 rounded border-l-4 border-green-500">{success}</div>}

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold mb-6">Add Integration</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">CRM Type</label>
            <select
              value={crmType}
              onChange={(e) => setCrmType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="hubspot">HubSpot</option>
              <option value="salesforce">Salesforce</option>
              <option value="pipedrive">Pipedrive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key"
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-6">Saved Integrations</h2>
        {integrations.length === 0 ? (
          <p className="text-gray-500">No integrations yet</p>
        ) : (
          <div className="space-y-4">
            {integrations.map((int) => (
              <div key={int.id} className="flex justify-between items-center p-4 border rounded">
                <div>
                  <h3 className="font-semibold">{int.crm_type.toUpperCase()}</h3>
                  <p className="text-sm text-gray-500">{int.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleTest(int.crm_type)}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    {testingCRM === int.crm_type ? 'Testing...' : 'Test'}
                  </button>
                  <button
                    onClick={() => handleImportContacts(int)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                  >
                    {importingCRM === int.crm_type ? 'Importing...' : 'Import'}
                  </button>
                  <button
                    onClick={() => handleDelete(int.crm_type)}
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}