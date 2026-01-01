// frontend/src/pages/SettingsPage.tsx
// COMPLETE FILE - Replace existing if present

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertCircle, CheckCircle2, Loader2, LogOut } from 'lucide-react';

interface HubSpotIntegration {
  id: string;
  provider: string;
  is_connected: boolean;
  connected_email?: string;
  connected_at?: string;
  refresh_token?: string;
}

interface ImportFilters {
  lead_status_exclude: string[];
  lifecycle_status_exclude: string[];
  properties_to_import: string[];
}

const HUBSPOT_LEAD_STATUS_OPTIONS = [
  'Unqualified',
  'Do Not Contact',
  'Unsubscribed',
  'Subscriber',
  'Qualified',
];

const HUBSPOT_LIFECYCLE_STATUS_OPTIONS = [
  'Unqualified',
  'Lead',
  'Customer',
  'Evangelist',
];

const DEFAULT_HUBSPOT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'company',
  'phone',
  'mobilephone',
  'linkedinurl',
  'jobtitle',
  'industry',
  'numberofemployees',
  'annualrevenue',
  'lifecyclestage',
  'hs_lead_status',
  'hs_analytics_last_touch_converting_campaign',
  'hs_analytics_last_visit',
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [hubspotIntegration, setHubspotIntegration] = useState<HubSpotIntegration | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    status: 'idle' | 'importing' | 'enriching' | 'complete' | 'error';
    total: number;
    imported: number;
    enriched: number;
    error?: string;
  }>({
    status: 'idle',
    total: 0,
    imported: 0,
    enriched: 0,
  });
  const [filters, setFilters] = useState<ImportFilters>({
    lead_status_exclude: ['Unqualified', 'Do Not Contact', 'Unsubscribed'],
    lifecycle_status_exclude: ['Unqualified'],
    properties_to_import: DEFAULT_HUBSPOT_PROPERTIES,
  });

  // Check HubSpot connection status on mount
  useEffect(() => {
    checkHubSpotConnection();
  }, []);

  const checkHubSpotConnection = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/hubspot/integration-status`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setHubspotIntegration(data);
      }
    } catch (error) {
      console.error('Error checking HubSpot connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectHubSpot = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get authorization URL from backend
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/hubspot/auth/authorize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Redirect to HubSpot OAuth
        window.location.href = data.authorization_url;
      }
    } catch (error) {
      console.error('Error initiating HubSpot connection:', error);
    }
  };

  const handleDisconnectHubSpot = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/hubspot/disconnect`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (response.ok) {
        setHubspotIntegration(null);
      }
    } catch (error) {
      console.error('Error disconnecting HubSpot:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportContacts = async () => {
    try {
      setImporting(true);
      setImportProgress({ status: 'importing', total: 0, imported: 0, enriched: 0 });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/hubspot/import`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filters: {
              lead_status_exclude: filters.lead_status_exclude,
              lifecycle_status_exclude: filters.lifecycle_status_exclude,
            },
            properties_to_import: filters.properties_to_import,
            auto_enrich: true, // Enable quick-enrich
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setImportProgress({
          status: 'complete',
          total: data.total_contacts,
          imported: data.imported,
          enriched: data.enrichment_queued,
        });

        // Refresh HubSpot status
        setTimeout(() => checkHubSpotConnection(), 2000);
      } else {
        const errorData = await response.json();
        setImportProgress({
          status: 'error',
          total: 0,
          imported: 0,
          enriched: 0,
          error: errorData.detail || 'Import failed',
        });
      }
    } catch (error) {
      console.error('Error importing contacts:', error);
      setImportProgress({
        status: 'error',
        total: 0,
        imported: 0,
        enriched: 0,
        error: String(error),
      });
    } finally {
      setImporting(false);
    }
  };

  const toggleLeadStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      lead_status_exclude: prev.lead_status_exclude.includes(status)
        ? prev.lead_status_exclude.filter(s => s !== status)
        : [...prev.lead_status_exclude, status],
    }));
  };

  const toggleLifecycleFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      lifecycle_status_exclude: prev.lifecycle_status_exclude.includes(status)
        ? prev.lifecycle_status_exclude.filter(s => s !== status)
        : [...prev.lifecycle_status_exclude, status],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your integrations and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="hubspot">HubSpot Integration</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          {/* HubSpot Integration Tab */}
          <TabsContent value="hubspot" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>HubSpot Connection</CardTitle>
                <CardDescription>Connect your HubSpot account to import contacts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {hubspotIntegration?.is_connected ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                    <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900">Connected to HubSpot</p>
                      <p className="text-sm text-green-700">
                        Connected as: <span className="font-semibold">{hubspotIntegration.connected_email}</span>
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Connected at: {hubspotIntegration.connected_at}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">Not connected</p>
                      <p className="text-sm text-blue-700">Click "Connect HubSpot" to authorize and start importing contacts</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleConnectHubSpot}
                    disabled={loading || hubspotIntegration?.is_connected}
                    className="flex items-center gap-2"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {hubspotIntegration?.is_connected ? 'Connected' : 'Connect HubSpot'}
                  </Button>

                  {hubspotIntegration?.is_connected && (
                    <Button
                      onClick={handleDisconnectHubSpot}
                      disabled={loading}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      <LogOut className="h-4 w-4" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Import Configuration */}
            {hubspotIntegration?.is_connected && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Import Filters</CardTitle>
                    <CardDescription>Configure which contacts to import from HubSpot</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Lead Status Filter */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Lead Status (Exclude)</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Uncheck statuses you want to import (unchecked = import)
                      </p>
                      <div className="space-y-2">
                        {HUBSPOT_LEAD_STATUS_OPTIONS.map(status => (
                          <label key={status} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={filters.lead_status_exclude.includes(status)}
                              onChange={() => toggleLeadStatusFilter(status)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Lifecycle Stage Filter */}
                    <div className="border-t pt-6">
                      <h4 className="font-medium text-gray-900 mb-3">Lifecycle Stage (Exclude)</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Uncheck stages you want to import (unchecked = import)
                      </p>
                      <div className="space-y-2">
                        {HUBSPOT_LIFECYCLE_STATUS_OPTIONS.map(status => (
                          <label key={status} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={filters.lifecycle_status_exclude.includes(status)}
                              onChange={() => toggleLifecycleFilter(status)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Import Progress */}
                <Card>
                  <CardHeader>
                    <CardTitle>Import Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {importProgress.status === 'idle' && (
                      <p className="text-sm text-gray-600">Click "Import Contacts" to start importing from HubSpot</p>
                    )}

                    {importProgress.status === 'importing' && (
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                        <div>
                          <p className="font-medium text-gray-900">Importing contacts...</p>
                          <p className="text-sm text-gray-600">This may take a few minutes</p>
                        </div>
                      </div>
                    )}

                    {importProgress.status === 'complete' && (
                      <div className="space-y-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="font-medium text-green-900">Import completed successfully!</p>
                          <div className="mt-3 space-y-2 text-sm text-green-700">
                            <p>✓ Total contacts fetched: <span className="font-semibold">{importProgress.total}</span></p>
                            <p>✓ Contacts imported: <span className="font-semibold">{importProgress.imported}</span></p>
                            <p>✓ Quick-enrich queued: <span className="font-semibold">{importProgress.enriched}</span></p>
                          </div>
                        </div>
                      </div>
                    )}

                    {importProgress.status === 'error' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="font-medium text-red-900">Import failed</p>
                        <p className="text-sm text-red-700 mt-2">{importProgress.error}</p>
                      </div>
                    )}

                    <Button
                      onClick={handleImportContacts}
                      disabled={importing || !hubspotIntegration?.is_connected || importProgress.status === 'importing'}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                      {importing ? 'Importing...' : 'Import Contacts Now'}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Placeholder tabs */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
