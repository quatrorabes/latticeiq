import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import CRMIntegrationCard from '../components/CRMIntegrationCard';

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
  created_at: string;
  updated_at: string;
}

const SettingsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<CRMIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const CRM_TYPES = [
    {
      id: 'hubspot',
      name: 'HubSpot',
      icon: '🎯',
      description: 'Connect your HubSpot CRM for intelligent contact importing',
      docs: 'https://developers.hubspot.com/docs/crm/apis/authentication'
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      icon: '☁️',
      description: 'Connect your Salesforce instance for enterprise contact management',
      docs: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/quickstart.htm'
    },
    {
      id: 'pipedrive',
      name: 'Pipedrive',
      icon: '📊',
      description: 'Connect your Pipedrive account for sales pipeline automation',
      docs: 'https://developers.pipedrive.com/docs/api/v1/'
    }
  ];

  // Fetch integrations on mount
  useEffect(() => {
    if (supabase) {
      fetchIntegrations();
    }
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

      const response = await fetch(`${apiUrl}/api/v3/settings/crm/integrations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch integrations');
      const data = await response.json();
      setIntegrations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleIntegrationUpdate = () => {
    fetchIntegrations();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl">⚙️</div>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">CRM Integrations</h1>
            <p className="text-lg text-slate-400">
              Connect and manage your CRM data sources with advanced filtering and validation
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-6xl mx-auto mb-8 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
          <p className="text-red-400">Error: {error}</p>
        </div>
      )}

      {/* CRM Cards Grid */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Loading integrations...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {CRM_TYPES.map((crm) => {
              const integration = integrations.find(i => i.crm_type === crm.id);
              return (
                <CRMIntegrationCard
                  key={crm.id}
                  crm={crm}
                  integration={integration}
                  onUpdate={handleIntegrationUpdate}
                  supabase={supabase}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="max-w-6xl mx-auto mt-16 p-8 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <h2 className="text-xl font-bold text-white mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <div className="text-2xl mb-2">🔐</div>
            <h3 className="font-semibold text-white mb-2">Secure Credentials</h3>
            <p className="text-sm text-slate-400">API keys are encrypted and stored securely in Supabase</p>
          </div>
          <div>
            <div className="text-2xl mb-2">🧪</div>
            <h3 className="font-semibold text-white mb-2">Test Connection</h3>
            <p className="text-sm text-slate-400">Verify your credentials work before enabling sync</p>
          </div>
          <div>
            <div className="text-2xl mb-2">⚙️</div>
            <h3 className="font-semibold text-white mb-2">Advanced Filters</h3>
            <p className="text-sm text-slate-400">Exclude unqualified leads, DNC records, and more</p>
          </div>
          <div>
            <div className="text-2xl mb-2">🔄</div>
            <h3 className="font-semibold text-white mb-2">Auto Sync</h3>
            <p className="text-sm text-slate-400">Keep your contacts up-to-date with periodic syncs</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
