// frontend/src/pages/CRMPage.tsx
// BEST PRACTICES VERSION - API key in request body

import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertCircle, CheckCircle2, Loader2, Upload, Link2, Eye, EyeOff } from 'lucide-react';

interface ImportStatus {
  status: 'idle' | 'testing' | 'importing' | 'complete' | 'error';
  message: string;
  imported?: number;
  total?: number;
  duplicates?: number;
  failed?: number;
}

const API_URL = import.meta.env.VITE_API_URL || '';

export default function CRMPage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [batchSize, setBatchSize] = useState<number>(50);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<number | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>({
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
      setConnectionVerified(false);
      setAvailableContacts(null);
      setImportStatus({ status: 'testing', message: 'Testing connection...' });

      const response = await fetch(`${API_URL}/api/v3/hubspot/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConnectionVerified(true);
        setAvailableContacts(data.contact_count);
        setImportStatus({
          status: 'complete',
          message: `Connected! Found ${data.contact_count.toLocaleString()} contacts in HubSpot`,
        });
      } else {
        setImportStatus({
          status: 'error',
          message: data.detail || data.message || 'Connection failed',
        });
      }
    } catch (error) {
      setImportStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Network error - is the backend running?',
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
      setImportStatus({ status: 'importing', message: `Importing ${batchSize} contacts...` });

      const response = await fetch(`${API_URL}/api/v3/hubspot/import-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          batch_size: batchSize,
          skip_duplicates: skipDuplicates,
          workspace_id: 'default', // TODO: Get from auth context
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setImportStatus({
          status: 'complete',
          message: data.message,
          imported: data.imported,
          total: data.total,
          duplicates: data.duplicates_skipped,
          failed: data.failed,
        });
      } else {
        setImportStatus({
          status: 'error',
          message: data.detail || data.message || 'Import failed',
        });
      }
    } catch (error) {
      setImportStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Network error - is the backend running?',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetStatus = () => {
    setImportStatus({ status: 'idle', message: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CRM Import</h1>
          <p className="text-gray-600 mt-2">Import contacts from HubSpot into LatticeIQ</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              HubSpot Connection
            </CardTitle>
            <CardDescription>
              Connect your HubSpot account to import contacts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Key Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HubSpot Private App Token
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setConnectionVerified(false);
                    setAvailableContacts(null);
                    resetStatus();
                  }}
                  placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                HubSpot → Settings → Integrations → Private Apps → Create app with "crm.objects.contacts.read" scope
              </p>
            </div>

            {/* Test Connection Button */}
            <Button
              onClick={handleTestConnection}
              disabled={testing || !apiKey.trim()}
              variant="outline"
              className="w-full"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : connectionVerified ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {testing ? 'Testing...' : connectionVerified ? 'Connection Verified' : 'Test Connection'}
            </Button>

            {/* Connection Success Info */}
            {connectionVerified && availableContacts !== null && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  ✓ Connected to HubSpot
                </p>
                <p className="text-green-700 text-sm mt-1">
                  {availableContacts.toLocaleString()} contacts available to import
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-medium text-gray-900 mb-4">Import Settings</h3>
            </div>

            {/* Batch Size Control */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Batch Size: <span className="font-bold text-blue-600">{batchSize}</span> contacts
              </label>
              <div className="flex gap-2">
                {[25, 50, 100, 200, 500].map(size => (
                  <Button
                    key={size}
                    variant={batchSize === size ? 'default' : 'outline'}
                    onClick={() => setBatchSize(size)}
                    className="flex-1"
                    size="sm"
                  >
                    {size}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Start with 25-50 for testing, increase once verified
              </p>
            </div>

            {/* Skip Duplicates Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Skip Duplicates</label>
                <p className="text-xs text-gray-500">Skip contacts that already exist (by email)</p>
              </div>
              <button
                type="button"
                onClick={() => setSkipDuplicates(!skipDuplicates)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  skipDuplicates ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    skipDuplicates ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Import Button */}
            <Button
              onClick={handleImport}
              disabled={loading || !apiKey.trim()}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {loading ? `Importing ${batchSize} contacts...` : `Import ${batchSize} Contacts`}
            </Button>

            {/* Status Messages */}
            {importStatus.status === 'testing' && (
              <StatusAlert variant="info" icon={<Loader2 className="h-5 w-5 animate-spin" />}>
                {importStatus.message}
              </StatusAlert>
            )}

            {importStatus.status === 'importing' && (
              <StatusAlert variant="info" icon={<Loader2 className="h-5 w-5 animate-spin" />}>
                <p>{importStatus.message}</p>
                <p className="text-xs mt-1">This may take a moment...</p>
              </StatusAlert>
            )}

            {importStatus.status === 'complete' && importStatus.imported !== undefined && (
              <StatusAlert variant="success" icon={<CheckCircle2 className="h-5 w-5" />}>
                <p className="font-medium">{importStatus.message}</p>
                <div className="text-sm mt-2 space-y-1">
                  <p>✓ {importStatus.imported} contacts imported</p>
                  {(importStatus.duplicates ?? 0) > 0 && (
                    <p>↔ {importStatus.duplicates} duplicates skipped</p>
                  )}
                  {(importStatus.failed ?? 0) > 0 && (
                    <p className="text-amber-700">⚠ {importStatus.failed} failed (no email)</p>
                  )}
                </div>
              </StatusAlert>
            )}

            {importStatus.status === 'error' && (
              <StatusAlert variant="error" icon={<AlertCircle className="h-5 w-5" />}>
                <p className="font-medium">Error</p>
                <p className="text-sm mt-1">{importStatus.message}</p>
              </StatusAlert>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Need help getting your HubSpot API key?</p>
          <a
            href="https://developers.hubspot.com/docs/api/private-apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View HubSpot Private Apps Documentation →
          </a>
        </div>
      </div>
    </div>
  );
}

// Helper component for status alerts
function StatusAlert({
  variant,
  icon,
  children,
}: {
  variant: 'info' | 'success' | 'error';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`border rounded-lg p-4 flex items-start gap-3 ${styles[variant]}`}>
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
