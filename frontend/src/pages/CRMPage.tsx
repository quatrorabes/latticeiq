// frontend/src/pages/CRMPage.tsx
// SIMPLIFIED VERSION - Just API key input + batch size

import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function CRMPage() {
  const [crmTab, setCrmTab] = useState<string>('hubspot');
  const [apiKey, setApiKey] = useState<string>('');
  const [batchSize, setBatchSize] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    status: 'idle' | 'testing' | 'importing' | 'complete' | 'error';
    message: string;
    imported?: number;
    total?: number;
  }>({
    status: 'idle',
    message: '',
  });

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setImportStatus({
        status: 'error',
        message: 'Please enter your HubSpot API key',
      });
      return;
    }

    try {
      setTesting(true);
      setImportStatus({ status: 'testing', message: 'Testing connection...' });

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/hubspot/test-connection?api_key=${encodeURIComponent(apiKey)}`
      , {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setImportStatus({
          status: 'complete',
          message: `✓ Connected! Found ${data.result?.contact_count || 0} contacts in HubSpot`,
        });
      } else {
        const error = await response.json();
        setImportStatus({
          status: 'error',
          message: error.detail || 'Connection failed',
        });
      }
    } catch (error) {
      setImportStatus({
        status: 'error',
        message: String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    if (!apiKey.trim()) {
      setImportStatus({
        status: 'error',
        message: 'Please enter your HubSpot API key',
      });
      return;
    }

    try {
      setLoading(true);
      setImportStatus({ status: 'importing', message: 'Importing contacts...' });

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/hubspot/import-batch?api_key=${encodeURIComponent(apiKey)}&batch_size=${batchSize}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setImportStatus({
          status: 'complete',
          message: `✓ Success! Imported ${data.imported} of ${data.total} contacts`,
          imported: data.imported,
          total: data.total,
        });
      } else {
        const error = await response.json();
        setImportStatus({
          status: 'error',
          message: error.detail || 'Import failed',
        });
      }
    } catch (error) {
      setImportStatus({
        status: 'error',
        message: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CRM Import</h1>
          <p className="text-gray-600 mt-2">Import contacts from HubSpot</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>HubSpot API Connection</CardTitle>
            <CardDescription>
              Enter your HubSpot API key to import contacts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Key Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HubSpot API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pat-na1-xxxxxxxxxxxxx"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-600 mt-2">
                Get your API key from HubSpot: Settings → Integrations → Private Apps
              </p>
            </div>

            {/* Test Connection Button */}
            <div>
              <Button
                onClick={handleTestConnection}
                disabled={testing || !apiKey.trim()}
                variant="outline"
                className="w-full"
              >
                {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Test Connection
              </Button>
            </div>

            {/* Batch Size Control */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Batch Size: <span className="font-bold text-blue-600">{batchSize}</span>
              </label>
              <div className="flex gap-2">
                {[50, 100, 200].map(size => (
                  <Button
                    key={size}
                    variant={batchSize === size ? 'default' : 'outline'}
                    onClick={() => setBatchSize(size)}
                    className="flex-1"
                  >
                    {size}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Number of contacts to import per batch (use smaller sizes for testing)
              </p>
            </div>

            {/* Import Button */}
            <div>
              <Button
                onClick={handleImport}
                disabled={loading || !apiKey.trim() || importStatus.status === 'testing'}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Import Contacts (Batch: {batchSize})
              </Button>
            </div>

            {/* Status Messages */}
            {importStatus.status === 'testing' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
                <p className="text-blue-700">{importStatus.message}</p>
              </div>
            )}

            {importStatus.status === 'complete' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">{importStatus.message}</p>
                  {importStatus.imported && importStatus.total && (
                    <p className="text-sm text-green-700 mt-2">
                      {importStatus.imported} / {importStatus.total} imported successfully
                    </p>
                  )}
                </div>
              </div>
            )}

            {importStatus.status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1">{importStatus.message}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
