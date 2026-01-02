import { useState } from 'react';
import { User, Database, Bell, Users, Key, Mail } from 'lucide-react';
import '../styles/SettingsPage.css';

type TabType = 'profile' | 'data-sources' | 'notifications' | 'workspace';

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

function DataSourcesTab() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [hubspotToken, setHubspotToken] = useState('');
  const [batchSize, setBatchSize] = useState(50);

  const handleCsvUpload = () => {
    if (!csvFile) {
      alert('Please select a CSV file');
      return;
    }
    alert(`Uploading ${csvFile.name}...`);
  };

  const handleHubspotImport = () => {
    if (!hubspotToken) {
      alert('Please enter your HubSpot API token');
      return;
    }
    alert(`Importing ${batchSize} contacts from HubSpot...`);
  };

  return (
    <div className="tab-content">
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
          <button onClick={handleCsvUpload} className="btn-primary">
            Upload CSV
          </button>
        )}

        <div className="info-box">
          <strong>CSV Format Requirements:</strong>
          <ul>
            <li>Must include: name, email, company</li>
            <li>Optional: job_title, phone, industry</li>
            <li>First row should contain column headers</li>
          </ul>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-header">
          <div>
            <h2>HubSpot Connection</h2>
            <p className="section-description">Connect your HubSpot account to import contacts</p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">HubSpot Private App Token</label>
          <input
            type="password"
            value={hubspotToken}
            onChange={(e) => setHubspotToken(e.target.value)}
            className="form-input"
            placeholder="pat-na1-xxxxxxxx-xxxx"
          />
          <span className="form-hint">
            HubSpot → Settings → Integrations → Private Apps → Create app with "crm.objects.contacts.read" scope
          </span>
        </div>

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
            <input type="checkbox" defaultChecked />
            <span>Skip Duplicates</span>
          </label>
          <span className="form-hint">Skip contacts that already exist (by email)</span>
        </div>

        <button onClick={handleHubspotImport} className="btn-primary">
          <Mail size={20} />
          Import {batchSize} Contacts
        </button>

        <div className="info-box">
          <strong>Need help getting your HubSpot API key?</strong>
          <a href="https://developers.hubspot.com/docs/api/private-apps" target="_blank" rel="noopener noreferrer" className="info-link">
            View HubSpot Private Apps Documentation →
          </a>
        </div>
      </div>

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
