// frontend/src/pages/SettingsPage.tsx - WITH LOGOUT BUTTON (CLEAN BUILD)

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface Integration {
  id: string;
  crm_type: string;
  api_key: string;
  created_at: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [crmType, setCrmType] = useState('hubspot');
  const [apiKey, setApiKey] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========================================
  // AUTH CHECK
  // ========================================

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate('/');
      return;
    }

    setUser(session.user);
  }

  // ========================================
  // LOGOUT
  // ========================================

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (err: any) {
      console.error('Logout error:', err);
      setError('Failed to log out');
    }
  }

  // ========================================
  // FETCH INTEGRATIONS WITH TOKEN
  // ========================================

  async function fetchIntegrations() {
    try {
      setLoading(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated. Please log in.');
        navigate('/');
        return;
      }

      const token = session.access_token;
      console.log('Token exists:', !!token);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/settings/crm/integrations`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('Fetch integrations response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (err: any) {
      console.error('Fetch integrations error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // SAVE INTEGRATION WITH TOKEN
  // ========================================

  async function handleSaveIntegration() {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!apiKey.trim()) {
        setError('API key is required');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated. Please log in.');
        navigate('/');
        return;
      }

      const token = session.access_token;
      console.log('Saving integration with token:', !!token);

      const response = await fetch(
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
          }),
        }
      );

      console.log('Save integration response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Parse response to fully drain body (avoids some fetch edge cases), but don't store it.
      await response.json();

      setSuccess(`${crmType.toUpperCase()} integration saved!`);
      setApiKey('');

      await fetchIntegrations();
    } catch (err: any) {
      console.error('Save integration error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // TEST CONNECTION WITH TOKEN
  // ========================================

  async function handleTestConnection(integration: Integration) {
    try {
      setTestingConnection(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated. Please log in.');
        return;
      }

      const token = session.access_token;
      console.log('Testing connection with token:', !!token);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/crm/test/${integration.crm_type}`,
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

      console.log('Test connection response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setSuccess('Connection successful!');
    } catch (err: any) {
      console.error('Test connection error:', err);
      setError(err.message);
    } finally {
      setTestingConnection(false);
    }
  }

  // ========================================
  // IMPORT CONTACTS WITH TOKEN
  // ========================================

  async function handleImportContacts(integration: Integration) {
    try {
      setLoading(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated. Please log in.');
        navigate('/');
        return;
      }

      const token = session.access_token;
      console.log('Importing contacts with token:', !!token);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/crm/import/${integration.crm_type}`,
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

      console.log('Import contacts response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const importResult = await response.json();
      setSuccess(`Imported ${importResult.count || 0} contacts!`);
    } catch (err: any) {
      console.error('Import contacts error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // DELETE INTEGRATION WITH TOKEN
  // ========================================

  async function handleDeleteIntegration(id: string) {
    try {
      setLoading(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated. Please log in.');
        return;
      }

      const token = session.access_token;
      console.log('Deleting integration with token:', !!token);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/settings/crm/integrations/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('Delete integration response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setSuccess('Integration deleted!');
      await fetchIntegrations();
    } catch (err: any) {
      console.error('Delete integration error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with Logout */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-2">Manage your CRM integrations</p>
            {user && <p className="text-sm text-gray-500 mt-1">Logged in as: {user.email}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Log Out
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">
              <strong>Success:</strong> {success}
            </p>
          </div>
        )}

        {/* Add New Integration */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Add CRM Integration
          </h2>

          <div className="space-y-4">
            {/* CRM Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CRM Type
              </label>
              <select
                value={crmType}
                onChange={(e) => setCrmType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="hubspot">HubSpot</option>
                <option value="salesforce">Salesforce</option>
                <option value="pipedrive">Pipedrive</option>
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your CRM API key"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Your API key is encrypted and stored securely.
              </p>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveIntegration}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Integration'}
            </button>
          </div>
        </div>

        {/* Saved Integrations */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Saved Integrations
          </h2>

          {loading && !integrations.length ? (
            <p className="text-gray-600">Loading integrations...</p>
          ) : integrations.length === 0 ? (
            <p className="text-gray-600">No integrations yet. Add one above!</p>
          ) : (
            <div className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {integration.crm_type.toUpperCase()}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(integration.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestConnection(integration)}
                      disabled={testingConnection || loading}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {testingConnection ? 'Testing...' : 'Test'}
                    </button>

                    <button
                      onClick={() => handleImportContacts(integration)}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Importing...' : 'Import'}
                    </button>

                    <button
                      onClick={() => handleDeleteIntegration(integration.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
          <p>
            <strong>Debug:</strong> Check browser console for token details. If "Token exists: false", user is not logged in.
          </p>
        </div>
      </div>
    </div>
  );
}
