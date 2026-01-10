// ============================================================================
// FILE: frontend/src/pages/SettingsPage.tsx
// PURPOSE: Settings page with Data Sources tab wired to real backend
// VERSION: 2.1.0 - Fixed HubSpot API key passing via header
// ============================================================================

import { useState, useEffect } from 'react';
import { User, Database, Bell, Users, Mail, Briefcase, CheckCircle, XCircle, Loader2, RefreshCw, Eye, Upload } from 'lucide-react';
import '../styles/SettingsPage.css';
import BusinessProfileForm from '../components/BusinessProfileForm';
import { API_URL, API_ENDPOINTS } from '../lib/constants';
import { supabase } from '../lib/supabaseClient';

type TabType = 'profile' | 'business' | 'data-sources' | 'notifications' | 'workspace';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  return (
    <div className="settings-page">
      <div className="page-header">
        <div className="header-main">
          <User size={32} />
          <div>
            <h1>Settings</h1>
            <p>Manage your account and workspace preferences</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={20} />
          <span>Profile</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'business' ? 'active' : ''}`}
          onClick={() => setActiveTab('business')}
        >
          <Briefcase size={20} />
          <span>Business</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'data-sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('data-sources')}
        >
          <Database size={20} />
          <span>Data Sources</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={20} />
          <span>Notifications</span>
        </button>
        <button
          className={`settings-tab ${activeTab === 'workspace' ? 'active' : ''}`}
          onClick={() => setActiveTab('workspace')}
        >
          <Users size={20} />
          <span>Workspace</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="settings-content">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'business' && <BusinessProfileForm />}
        {activeTab === 'data-sources' && <DataSourcesTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'workspace' && <WorkspaceTab />}
      </div>
    </div>
  );
}

function ProfileTab() {
  const [name, setName] = useState('John Doe');
  const [email, setEmail] = useState('john@example.com');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSaveProfile = () => {
    alert('Profile updated successfully!');
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    alert('Password changed successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="tab-content">
      <div className="settings-section">
        <h2>Profile Information</h2>
        <p className="section-description">Update your personal information</p>

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
          />
        </div>

        <button onClick={handleSaveProfile} className="btn-primary">
          Save Changes
        </button>
      </div>

      <div className="settings-section">
        <h2>Change Password</h2>
        <p className="section-description">Ensure your account stays secure</p>

        <div className="form-group">
          <label className="form-label">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="form-input"
          />
        </div>

        <button onClick={handleChangePassword} className="btn-primary">
          Change Password
        </button>
      </div>
    </div>
  );
}


// ============================================================================
// DATA SOURCES TAB - WIRED TO BACKEND
// ============================================================================

interface TestResult {
  success: boolean;
  provider: string;
  account_id?: string;
  account_name?: string;
  contact_count?: number;
  error?: string;
}

interface ImportPreview {
  total_contacts: number;
  valid_contacts: number;
  rejected_contacts: number;
  rejection_reasons: Record<string, number>;
  sample_contacts: any[];
}

interface ImportResult {
  success: boolean;
  import_id: string;
  total_processed: number;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  rejection_reasons: Record<string, number>;
}

function DataSourcesTab() {
  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  
  // HubSpot state
  const [hubspotToken, setHubspotToken] = useState('');
  const [batchSize, setBatchSize] = useState(50);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  
  // Connection state
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  
  // Import state
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ============================================================================
  // AUTH HELPER
  // ============================================================================

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated - please log in again');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  };

  // ============================================================================
  // CHECK EXISTING CONNECTION ON MOUNT
  // ============================================================================

  useEffect(() => {
    checkExistingConnection();
  }, []);

  const checkExistingConnection = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v3/integrations/hubspot/status`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'connected') {
          setIsConnected(true);
          setConnectionInfo(data);
        }
      }
    } catch (err) {
      // No existing connection, that's fine
      console.log('No existing HubSpot connection');
    }
  };

  // ============================================================================
  // CSV UPLOAD
  // ============================================================================

  const handleCsvUpload = async () => {
    if (!csvFile) {
      alert('Please select a CSV file');
      return;
    }

    setCsvUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch(`${API_URL}/api/v3/import/csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Successfully imported ${result.imported_count} contacts!`);
        setCsvFile(null);
      } else {
        const error = await response.json();
        alert(`❌ Import failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
    } finally {
      setCsvUploading(false);
    }
  };

  // ============================================================================
  // HUBSPOT TEST CONNECTION
  // ============================================================================

  const handleTestConnection = async () => {
    if (!hubspotToken) {
      alert('Please enter your HubSpot API token');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_URL}/api/v3/integrations/hubspot/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ api_key: hubspotToken })
      });

      const result = await response.json();
      setTestResult(result);

    } catch (err) {
      setTestResult({
        success: false,
        provider: 'hubspot',
        error: err instanceof Error ? err.message : 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  // ============================================================================
  // HUBSPOT CONNECT (SAVE CREDENTIALS)
  // ============================================================================

  const handleConnect = async () => {
    if (!testResult?.success) {
      alert('Please test the connection first');
      return;
    }

    setTesting(true);

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_URL}/api/v3/integrations/hubspot/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ api_key: hubspotToken })
      });

      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);
        setConnectionInfo(data);
        setHubspotToken(''); // Clear the input
        alert('✅ HubSpot connected successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Connection failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Connection failed'}`);
    } finally {
      setTesting(false);
    }
  };

  // ============================================================================
  // HUBSPOT PREVIEW IMPORT (FIXED - uses header)
  // ============================================================================

  const handlePreviewImport = async () => {
    setPreviewing(true);
    setImportPreview(null);

    try {
      const headers = await getAuthHeaders();
      
      // Pass API key via header if not connected
      if (!isConnected && hubspotToken) {
        headers['X-HubSpot-API-Key'] = hubspotToken;
      }

      const response = await fetch(`${API_URL}/api/v3/hubspot/preview?sample_size=50`, { 
        headers 
      });

      if (response.ok) {
        const data = await response.json();
        setImportPreview({
          total_contacts: data.total_available || 0,
          valid_contacts: data.valid_count || 0,
          rejected_contacts: data.invalid_count || 0,
          rejection_reasons: data.rejection_reasons || {},
          sample_contacts: data.sample_contacts || []
        });
      } else {
        const error = await response.json();
        alert(`❌ Preview failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Preview failed'}`);
    } finally {
      setPreviewing(false);
    }
  };

  // ============================================================================
  // HUBSPOT IMPORT (FIXED - uses header)
  // ============================================================================

  const handleHubspotImport = async () => {
    if (!isConnected && !hubspotToken) {
      alert('Please enter your HubSpot API token or connect your account first');
      return;
    }

    const confirmMsg = importPreview 
      ? `Import ${importPreview.valid_contacts} contacts from HubSpot?`
      : `Import up to ${batchSize} contacts from HubSpot?`;
    
    if (!confirm(confirmMsg)) return;

    setImporting(true);
    setImportResult(null);

    try {
      const headers = await getAuthHeaders();
      
      // Pass API key via header if not connected
      if (!isConnected && hubspotToken) {
        headers['X-HubSpot-API-Key'] = hubspotToken;
      }

      const body = {
        filters: {
          require_email: true,
          skip_existing: skipDuplicates,
          limit: batchSize
        }
      };

      const response = await fetch(`${API_URL}/api/v3/hubspot/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        setImportResult(result);
        setImportPreview(null); // Clear preview
        
        // Refresh connection info
        checkExistingConnection();
      } else {
        const error = await response.json();
        alert(`❌ Import failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Import failed'}`);
    } finally {
      setImporting(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="tab-content">
      {/* CSV Upload Section */}
      <div className="settings-section">
        <div className="section-header">
          <div>
            <h2>Upload CSV File</h2>
            <p className="section-description">Import contacts from a CSV file</p>
          </div>
        </div>

        <div className="upload-area">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            className="file-input"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="file-label">
            <Database size={48} />
            <span className="file-label-text">
              {csvFile ? csvFile.name : 'Click to select CSV file'}
            </span>
            <span className="file-label-hint">Supports .csv files</span>
          </label>
        </div>

        {csvFile && (
          <button 
            onClick={handleCsvUpload} 
            className="btn-primary"
            disabled={csvUploading}
          >
            {csvUploading ? (
              <>
                <Loader2 size={20} className="spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={20} />
                Upload CSV
              </>
            )}
          </button>
        )}

        <div className="info-box">
          <strong>CSV Format Requirements:</strong>
          <ul>
            <li>Must include: first_name, last_name</li>
            <li>At least ONE of: email, phone, company, linkedin_url</li>
            <li>Optional: job_title, industry, city, state</li>
            <li>First row should contain column headers</li>
          </ul>
        </div>
      </div>

      {/* HubSpot Section */}
      <div className="settings-section">
        <div className="section-header">
          <div>
            <h2>HubSpot Connection</h2>
            <p className="section-description">Connect your HubSpot account to import contacts</p>
          </div>
          {isConnected && (
            <span className="status-badge connected">
              <CheckCircle size={16} />
              Connected
            </span>
          )}
        </div>

        {/* Show connection info if connected */}
        {isConnected && connectionInfo && (
          <div className="connection-info">
            <div className="info-row">
              <span className="info-label">Account:</span>
              <span className="info-value">{connectionInfo.account_name || connectionInfo.account_id}</span>
            </div>
            {connectionInfo.total_imported > 0 && (
              <div className="info-row">
                <span className="info-label">Total Imported:</span>
                <span className="info-value">{connectionInfo.total_imported.toLocaleString()} contacts</span>
              </div>
            )}
            {connectionInfo.last_sync_at && (
              <div className="info-row">
                <span className="info-label">Last Import:</span>
                <span className="info-value">{new Date(connectionInfo.last_sync_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Token input - only show if not connected */}
        {!isConnected && (
          <>
            <div className="form-group">
              <label className="form-label">HubSpot Private App Token</label>
              <input
                type="password"
                value={hubspotToken}
                onChange={(e) => setHubspotToken(e.target.value)}
                className="form-input"
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <span className="form-hint">
                HubSpot → Settings → Integrations → Private Apps → Create app with "crm.objects.contacts.read" scope
              </span>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`alert ${testResult.success ? 'alert-success' : 'alert-error'}`}>
                {testResult.success ? (
                  <>
                    <CheckCircle size={20} />
                    <div>
                      <strong>Connection successful!</strong>
                      <p>Account: {testResult.account_name || testResult.account_id}</p>
                      {testResult.contact_count !== undefined && (
                        <p>{testResult.contact_count.toLocaleString()} contacts available</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle size={20} />
                    <span>{testResult.error}</span>
                  </>
                )}
              </div>
            )}

            {/* Test & Connect buttons */}
            <div className="button-row">
              <button
                onClick={handleTestConnection}
                className="btn-secondary"
                disabled={!hubspotToken || testing}
              >
                {testing ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Test Connection
                  </>
                )}
              </button>

              <button
                onClick={handleConnect}
                className="btn-primary"
                disabled={!testResult?.success || testing}
              >
                <CheckCircle size={16} />
                Save Connection
              </button>
            </div>
          </>
        )}

        {/* Import Settings - show if connected OR has valid test */}
        {(isConnected || testResult?.success) && (
          <>
            <div className="form-group">
              <label className="form-label">Import Settings</label>
              <div className="form-row">
                <div>
                  <label className="form-label-sm">Batch Size</label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value))}
                    className="form-input"
                  >
                    <option value={25}>25 contacts</option>
                    <option value={50}>50 contacts</option>
                    <option value={100}>100 contacts</option>
                    <option value={200}>200 contacts</option>
                    <option value={500}>500 contacts</option>
                  </select>
                </div>
              </div>
              <span className="form-hint">
                Start with 25-50 for testing, increase once verified
              </span>
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
                <span>Skip Duplicates</span>
              </label>
              <span className="form-hint">Skip contacts that already exist (by email)</span>
            </div>

            {/* Import Preview */}
            {importPreview && (
              <div className="preview-box">
                <h4>Import Preview</h4>
                <div className="preview-stats">
                  <div className="stat">
                    <span className="stat-value">{importPreview.total_contacts.toLocaleString()}</span>
                    <span className="stat-label">Total in HubSpot</span>
                  </div>
                  <div className="stat valid">
                    <span className="stat-value">{importPreview.valid_contacts.toLocaleString()}</span>
                    <span className="stat-label">Valid to Import</span>
                  </div>
                  <div className="stat rejected">
                    <span className="stat-value">{importPreview.rejected_contacts.toLocaleString()}</span>
                    <span className="stat-label">Will be Skipped</span>
                  </div>
                </div>
                
                {Object.keys(importPreview.rejection_reasons).length > 0 && (
                  <div className="rejection-reasons">
                    <strong>Skip Reasons:</strong>
                    <ul>
                      {Object.entries(importPreview.rejection_reasons).map(([reason, count]) => (
                        <li key={reason}>
                          {reason.replace(/_/g, ' ')}: {count}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className="alert alert-success">
                <CheckCircle size={20} />
                <div>
                  <strong>Import Complete!</strong>
                  <p>Successfully imported {importResult.imported_count.toLocaleString()} contacts.</p>
                  {importResult.skipped_count > 0 && (
                    <p>{importResult.skipped_count} skipped (duplicates or invalid)</p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="button-row">
              <button
                onClick={handlePreviewImport}
                className="btn-secondary"
                disabled={previewing || importing}
              >
                {previewing ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Loading Preview...
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    Preview Import
                  </>
                )}
              </button>

              <button 
                onClick={handleHubspotImport} 
                className="btn-primary"
                disabled={importing || previewing}
              >
                {importing ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Mail size={20} />
                    Import {importPreview ? importPreview.valid_contacts.toLocaleString() : batchSize} Contacts
                  </>
                )}
              </button>
            </div>
          </>
        )}

        <div className="info-box">
          <strong>Need help getting your HubSpot API key?</strong>
          <a href="https://developers.hubspot.com/docs/api/private-apps" target="_blank" rel="noopener noreferrer" className="info-link">
            View HubSpot Private Apps Documentation →
          </a>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div className="settings-section">
        <div className="section-header">
          <div>
            <h2>Coming Soon</h2>
            <p className="section-description">Additional data source integrations</p>
          </div>
        </div>

        <div className="coming-soon-grid">
          <div className="coming-soon-card">
            <div className="coming-soon-icon">📊</div>
            <h3>Salesforce</h3>
            <p>Sync contacts and deals</p>
            <span className="coming-soon-badge">Q1 2026</span>
          </div>
          <div className="coming-soon-card">
            <div className="coming-soon-icon">🔗</div>
            <h3>Pipedrive</h3>
            <p>Import pipeline data</p>
            <span className="coming-soon-badge">Q1 2026</span>
          </div>
          <div className="coming-soon-card">
            <div className="coming-soon-icon">💼</div>
            <h3>LinkedIn</h3>
            <p>Extract lead information</p>
            <span className="coming-soon-badge">Q2 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}


function NotificationsTab() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [hotLeadAlerts, setHotLeadAlerts] = useState(true);
  const [enrichmentComplete, setEnrichmentComplete] = useState(true);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [minScore, setMinScore] = useState(70);

  const handleSaveNotifications = () => {
    alert('Notification settings saved!');
  };

  return (
    <div className="tab-content">
      <div className="settings-section">
        <h2>Email Notifications</h2>
        <p className="section-description">Control when we send you emails</p>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
            />
            <span>Enable email notifications</span>
          </label>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={hotLeadAlerts}
              onChange={(e) => setHotLeadAlerts(e.target.checked)}
            />
            <span>Notify for hot leads (score ≥ 70)</span>
          </label>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enrichmentComplete}
              onChange={(e) => setEnrichmentComplete(e.target.checked)}
            />
            <span>Notify when enrichment completes</span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h2>Slack Integration</h2>
        <p className="section-description">Get real-time alerts in Slack</p>

        <div className="form-group">
          <label className="form-label">Slack Webhook URL</label>
          <input
            type="text"
            value={slackWebhook}
            onChange={(e) => setSlackWebhook(e.target.value)}
            className="form-input"
            placeholder="https://hooks.slack.com/services/..."
          />
          <span className="form-hint">
            Get your webhook URL from <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer">Slack's incoming webhooks page</a>
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Minimum score for notifications</label>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(parseInt(e.target.value))}
            className="form-input"
            min="0"
            max="100"
          />
          <span className="form-hint">Only notify for leads with ICP score above this threshold</span>
        </div>

        <button onClick={handleSaveNotifications} className="btn-primary">
          Save Notification Settings
        </button>
      </div>
    </div>
  );
}


function WorkspaceTab() {
  const [workspaceName, setWorkspaceName] = useState('Acme Corp Sales');
  const [teamSize, setTeamSize] = useState('5-10');

  const handleSaveWorkspace = () => {
    alert('Workspace settings saved!');
  };

  return (
    <div className="tab-content">
      <div className="settings-section">
        <h2>Workspace Settings</h2>
        <p className="section-description">Manage your team workspace</p>

        <div className="form-group">
          <label className="form-label">Workspace Name</label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Team Size</label>
          <select
            value={teamSize}
            onChange={(e) => setTeamSize(e.target.value)}
            className="form-input"
          >
            <option value="1">Just me</option>
            <option value="2-5">2-5 people</option>
            <option value="5-10">5-10 people</option>
            <option value="10-25">10-25 people</option>
            <option value="25+">25+ people</option>
          </select>
        </div>

        <button onClick={handleSaveWorkspace} className="btn-primary">
          Save Workspace Settings
        </button>
      </div>

      <div className="settings-section">
        <h2>Team Members</h2>
        <p className="section-description">Manage who has access to your workspace</p>

        <div className="info-box">
          <strong>Coming Soon:</strong> Invite team members, manage roles and permissions
        </div>
      </div>

      <div className="settings-section danger-zone">
        <h2>Danger Zone</h2>
        <p className="section-description">Irreversible actions</p>

        <button className="btn-danger">
          Delete Workspace
        </button>
      </div>
    </div>
  );
}
