import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Integration {
  id: string;
  user_id: string;
  crm_type: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type NullableString = string | null;

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [crmType, setCrmType] = useState("hubspot");
  const [apiKey, setApiKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NullableString>(null);
  const [success, setSuccess] = useState<NullableString>(null);

  const [testingCRM, setTestingCRM] = useState<NullableString>(null);
  const [importingCRM, setImportingCRM] = useState<NullableString>(null);

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const isConfigured = useMemo(() => !!apiUrl, [apiUrl]);

  const getAuthToken = async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) throw new Error("Not logged in (missing access token).");
    return token;
  };

  const fetchIntegrations = async () => {
    if (!apiUrl) {
      setError("Missing VITE_API_URL in frontend environment.");
      return;
    }

    try {
      setError(null);
      const token = await getAuthToken();

      const res = await fetch(`${apiUrl}/api/v3/settings/crm/integrations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to fetch integrations (${res.status}): ${txt}`);
      }

      const data = await res.json();
      setIntegrations(data.integrations || []);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  useEffect(() => {
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiUrl) {
      setError("Missing VITE_API_URL in frontend environment.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();

      const res = await fetch(`${apiUrl}/api/v3/settings/crm/integrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          crm_type: crmType,
          api_key: apiKey,
          is_active: true,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.detail || data?.error || "Failed to save integration.");
        return;
      }

      setSuccess(data?.message || `${crmType.toUpperCase()} saved!`);
      setApiKey("");
      await fetchIntegrations();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (type: string) => {
    if (!apiUrl) {
      setError("Missing VITE_API_URL in frontend environment.");
      return;
    }

    setTestingCRM(type);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();

      const res = await fetch(
        `${apiUrl}/api/v3/settings/crm/integrations/${type}/test`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.detail || data?.error || "Test failed");
        return;
      }

      setSuccess(data?.message || "Connection successful!");
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setTestingCRM(null);
    }
  };

  const handleImportContacts = async (type: string) => {
    if (!apiUrl) {
      setError("Missing VITE_API_URL in frontend environment.");
      return;
    }

    setImportingCRM(type);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();

      // IMPORTANT: No request body — backend reads api_key from crm_integrations table.
      const res = await fetch(`${apiUrl}/api/v3/crm/import/${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.detail || data?.error || "Import failed");
        return;
      }

      const jobId = data?.job_id || data?.jobId || data?.id || "unknown";
      setSuccess(data?.message || `Import started! Job ID: ${jobId}`);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setImportingCRM(null);
    }
  };

  const handleDelete = async (type: string) => {
    if (!apiUrl) {
      setError("Missing VITE_API_URL in frontend environment.");
      return;
    }

    if (!confirm(`Delete ${type}?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();

      const res = await fetch(`${apiUrl}/api/v3/settings/crm/integrations/${type}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Delete failed (${res.status}): ${txt}`);
      }

      setSuccess(`${type.toUpperCase()} deleted!`);
      await fetchIntegrations();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const hubspotIntegration = useMemo(
    () => integrations.find((i) => i.crm_type === "hubspot" && i.is_active),
    [integrations]
  );

  if (!isConfigured) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">CRM Settings</h1>
        <div className="bg-red-100 p-4 rounded text-red-700">
          Missing <code>VITE_API_URL</code>. Set it to your Render base URL (no trailing slash).
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">CRM Settings</h1>

      {error && <div className="bg-red-100 p-4 mb-4 rounded text-red-700">{error}</div>}
      {success && (
        <div className="bg-green-100 p-4 mb-4 rounded text-green-700">{success}</div>
      )}

      {/* Optional quick action (visible only if HubSpot is saved & active) */}
      <div className="bg-white p-6 rounded shadow mb-6 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">Quick actions</div>
          <div className="text-sm text-gray-500">
            Import uses the saved key from Settings (no API key sent in the request).
          </div>
        </div>

        <button
          onClick={() => handleImportContacts("hubspot")}
          disabled={!hubspotIntegration || importingCRM === "hubspot"}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          title={!hubspotIntegration ? "Save and activate HubSpot first" : "Start HubSpot import"}
        >
          {importingCRM === "hubspot" ? "Importing..." : "Import HubSpot"}
        </button>
      </div>

      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-lg font-bold mb-4">Add Integration</h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">CRM Type</label>
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
            <label className="block text-sm font-medium">API Key</label>
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
            className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-bold mb-4">Saved Integrations</h2>

        {integrations.length === 0 ? (
          <p className="text-gray-500">No integrations yet</p>
        ) : (
          <div className="space-y-4">
            {integrations.map((int) => (
              <div key={int.id} className="flex items-center justify-between p-4 border rounded">
                <div>
                  <div className="font-bold">{int.crm_type.toUpperCase()}</div>
                  <div className="text-sm text-gray-500">
                    {int.is_active ? "Active" : "Inactive"}
                  </div>
                </div>

                <div className="space-x-2">
                  <button
                    onClick={() => handleTest(int.crm_type)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    disabled={testingCRM === int.crm_type}
                  >
                    {testingCRM === int.crm_type ? "Testing..." : "Test"}
                  </button>

                  {/* THIS IS THE IMPORT BUTTON */}
                  <button
                    onClick={() => handleImportContacts(int.crm_type)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    disabled={importingCRM === int.crm_type}
                  >
                    {importingCRM === int.crm_type ? "Importing..." : "Import"}
                  </button>

                  <button
                    onClick={() => handleDelete(int.crm_type)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
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
