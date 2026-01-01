import React, { useState } from 'react';
import { Zap, CheckCircle, XCircle, Send, Webhook, AlertCircle } from 'lucide-react';
import '../styles/IntegrationsPage.css';

interface SlackConfig {
  webhook_url: string;
  channel: string;
  notify_hot_leads: boolean;
  notify_enrichment: boolean;
  min_score_notify: number;
}

interface WebhookConfig {
  id?: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

export const IntegrationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'slack' | 'webhooks'>('slack');
  
  // Slack state
  const [slackConfig, setSlackConfig] = useState<SlackConfig>({
    webhook_url: '',
    channel: '#sales',
    notify_hot_leads: true,
    notify_enrichment: true,
    min_score_notify: 70
  });
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<'success' | 'error' | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newWebhook, setNewWebhook] = useState<WebhookConfig>({
    url: '',
    events: [],
    secret: '',
    active: true
  });

  const testSlackConnection = async () => {
    setSlackTesting(true);
    setSlackTestResult(null);

    try {
      // In production:
      // await fetch('/api/v3/integrations/slack/test', { method: 'POST' });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSlackTestResult('success');
      setSlackConnected(true);
    } catch (err) {
      setSlackTestResult('error');
    } finally {
      setSlackTesting(false);
    }
  };

  const saveSlackConfig = async () => {
    try {
      // In production:
      // await fetch('/api/v3/integrations/slack/config', {
      //   method: 'POST',
      //   body: JSON.stringify(slackConfig)
      // });
      
      alert('Slack configuration saved!');
    } catch (err) {
      console.error('Failed to save Slack config:', err);
    }
  };

  const disconnectSlack = () => {
    setSlackConnected(false);
    setSlackConfig({
      webhook_url: '',
      channel: '#sales',
      notify_hot_leads: true,
      notify_enrichment: true,
      min_score_notify: 70
    });
  };

  const addWebhook = () => {
    if (!newWebhook.url || newWebhook.events.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setWebhooks([...webhooks, { ...newWebhook, id: Date.now().toString() }]);
    setNewWebhook({
      url: '',
      events: [],
      secret: '',
      active: true
    });
    setShowWebhookForm(false);
  };

  const toggleWebhookEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  const deleteWebhook = (id: string) => {
    setWebhooks(webhooks.filter(w => w.id !== id));
  };

  return (
    <div className="integrations-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-main">
          <Zap size={32} />
          <div>
            <h1>Integrations</h1>
            <p>Connect LatticeIQ with your favorite tools</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'slack' ? 'active' : ''}`}
          onClick={() => setActiveTab('slack')}
        >
          <img src="https://cdn.simpleicons.org/slack" alt="Slack" width="20" height="20" />
          Slack
        </button>
        <button
          className={`tab-btn ${activeTab === 'webhooks' ? 'active' : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          <Webhook size={20} />
          Webhooks
        </button>
      </div>

      {/* Slack Tab */}
      {activeTab === 'slack' && (
        <div className="integration-content">
          <div className="integration-card">
            <div className="card-header">
              <div className="card-title">
                <img src="https://cdn.simpleicons.org/slack" alt="Slack" width="32" height="32" />
                <div>
                  <h2>Slack Notifications</h2>
                  <p>Get real-time alerts for hot leads and enrichment updates</p>
                </div>
              </div>
              {slackConnected && (
                <span className="status-badge connected">
                  <CheckCircle size={16} />
                  Connected
                </span>
              )}
            </div>

            <div className="card-body">
              <div className="form-group">
                <label>Webhook URL *</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackConfig.webhook_url}
                  onChange={(e) => setSlackConfig({ ...slackConfig, webhook_url: e.target.value })}
                />
                <small className="form-help">
                  Get your webhook URL from{' '}
                  <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer">
                    Slack's incoming webhooks page
                  </a>
                </small>
              </div>

              <div className="form-group">
                <label>Channel</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="#sales"
                  value={slackConfig.channel}
                  onChange={(e) => setSlackConfig({ ...slackConfig, channel: e.target.value })}
                />
              </div>

              <div className="form-group">
                <h3>Notification Settings</h3>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={slackConfig.notify_hot_leads}
                    onChange={(e) => setSlackConfig({ ...slackConfig, notify_hot_leads: e.target.checked })}
                  />
                  <span>Notify for hot leads (score ≥ {slackConfig.min_score_notify})</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={slackConfig.notify_enrichment}
                    onChange={(e) => setSlackConfig({ ...slackConfig, notify_enrichment: e.target.checked })}
                  />
                  <span>Notify when enrichment completes</span>
                </label>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label>Minimum score for notifications: {slackConfig.min_score_notify}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={slackConfig.min_score_notify}
                    onChange={(e) => setSlackConfig({ ...slackConfig, min_score_notify: parseInt(e.target.value) })}
                    className="form-range"
                  />
                </div>
              </div>

              {slackTestResult && (
                <div className={`alert ${slackTestResult === 'success' ? 'alert-success' : 'alert-error'}`}>
                  {slackTestResult === 'success' ? (
                    <>
                      <CheckCircle size={20} />
                      <span>Test notification sent successfully!</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={20} />
                      <span>Failed to send test notification. Check your webhook URL.</span>
                    </>
                  )}
                </div>
              )}

              <div className="card-actions">
                <button
                  className="btn-secondary"
                  onClick={testSlackConnection}
                  disabled={!slackConfig.webhook_url || slackTesting}
                >
                  <Send size={16} />
                  {slackTesting ? 'Testing...' : 'Send Test'}
                </button>
                
                <button
                  className="btn-primary"
                  onClick={saveSlackConfig}
                  disabled={!slackConfig.webhook_url}
                >
                  Save Configuration
                </button>

                {slackConnected && (
                  <button className="btn-danger" onClick={disconnectSlack}>
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="integration-content">
          <div className="integration-card">
            <div className="card-header">
              <div className="card-title">
                <Webhook size={32} />
                <div>
                  <h2>Custom Webhooks</h2>
                  <p>Push events to external systems</p>
                </div>
              </div>
              <button className="btn-primary" onClick={() => setShowWebhookForm(!showWebhookForm)}>
                {showWebhookForm ? 'Cancel' : 'Add Webhook'}
              </button>
            </div>

            {showWebhookForm && (
              <div className="webhook-form">
                <div className="form-group">
                  <label>Endpoint URL *</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://your-app.com/webhooks/latticeiq"
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Events to Subscribe *</label>
                  <div className="checkbox-group">
                    {['enrichment_completed', 'score_changed', 'stage_changed', 'contact_created', 'contact_updated'].map(event => (
                      <label key={event} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newWebhook.events.includes(event)}
                          onChange={() => toggleWebhookEvent(event)}
                        />
                        <span>{event.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Secret Key (Optional)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Used for HMAC signature verification"
                    value={newWebhook.secret}
                    onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                  />
                </div>

                <button className="btn-primary" onClick={addWebhook}>
                  Create Webhook
                </button>
              </div>
            )}

            <div className="webhooks-list">
              {webhooks.length === 0 ? (
                <div className="empty-state">
                  <Webhook size={48} />
                  <h3>No webhooks configured</h3>
                  <p>Add your first webhook to start receiving events</p>
                </div>
              ) : (
                webhooks.map(webhook => (
                  <div key={webhook.id} className="webhook-item">
                    <div className="webhook-info">
                      <div className="webhook-url">{webhook.url}</div>
                      <div className="webhook-events">
                        Events: {webhook.events.join(', ')}
                      </div>
                    </div>
                    <div className="webhook-actions">
                      <span className={`status-badge ${webhook.active ? 'active' : 'inactive'}`}>
                        {webhook.active ? 'Active' : 'Inactive'}
                      </span>
                      <button className="btn-danger-small" onClick={() => deleteWebhook(webhook.id!)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="info-banner">
            <AlertCircle size={20} />
            <div>
              <strong>Webhook Security</strong>
              <p>All webhook payloads are signed with HMAC-SHA256. Verify signatures using your secret key.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsPage;
