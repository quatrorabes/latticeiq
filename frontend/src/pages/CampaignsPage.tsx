import { useState, useEffect } from 'react';
import { campaignApi, templateApi, Campaign, EmailTemplate } from '../api/campaigns';
import { icpApi, ICP } from '../api/icps';
import { Play, Pause, Plus, Zap, Target, Mail } from 'lucide-react';
import '../styles/CampaignsPage.css';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await campaignApi.list();
      setCampaigns(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="campaigns-page">
        <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
          Loading campaigns...
        </div>
      </div>
    );
  }

  return (
    <div className="campaigns-page">
      <div className="page-header">
        <div className="header-main">
          <Zap size={32} />
          <div>
            <h1>Campaigns</h1>
            <p>Launch targeted outreach to your ideal clients</p>
          </div>
        </div>
        <button onClick={() => setShowBuilder(true)} className="btn-primary">
          <Plus size={20} />
          New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state">
          <Zap size={64} />
          <p>No campaigns yet</p>
          <button onClick={() => setShowBuilder(true)} className="btn-primary">
            Create your first campaign →
          </button>
        </div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {showBuilder && (
        <CampaignBuilder
          onClose={() => setShowBuilder(false)}
          onSuccess={() => {
            setShowBuilder(false);
            loadCampaigns();
          }}
        />
      )}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const statusColors = {
    draft: 'bg-slate-500/20 text-slate-400',
    active: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className="campaign-card">
      <div className="campaign-header">
        <h3>{campaign.name}</h3>
        <span className={`status-badge ${statusColors[campaign.status]}`}>
          {campaign.status}
        </span>
      </div>
      {campaign.description && <p className="campaign-description">{campaign.description}</p>}
      <div className="campaign-meta">
        <div className="meta-item">
          <Target size={16} />
          <span>Min Score: {campaign.min_icp_score}</span>
        </div>
        {campaign.max_contacts && (
          <div className="meta-item">
            <Mail size={16} />
            <span>Max: {campaign.max_contacts} contacts</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignBuilder({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icps, setIcps] = useState<ICP[]>([]);
  const [selectedIcp, setSelectedIcp] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [minScore, setMinScore] = useState(60);
  const [maxContacts, setMaxContacts] = useState('');
  const [previews, setPreviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [icpData, templateData] = await Promise.all([
        icpApi.list(),
        templateApi.listEmail(),
      ]);
      setIcps(icpData);
      setTemplates(templateData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const campaign = await campaignApi.create({
        name,
        description,
        icp_id: selectedIcp,
        email_template_id: selectedTemplate,
        min_icp_score: minScore,
        max_contacts: maxContacts ? parseInt(maxContacts) : undefined,
        status: 'draft',
      });

      // Load preview
      const previewData = await campaignApi.preview(campaign.id, 3);
      setPreviews(previewData);
      setStep(3);
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    // Will implement activation in backend
    alert('Campaign created! Activation coming soon.');
    onSuccess();
  };

  return (
    <div className="modal-overlay">
      <div className="modal campaign-builder-modal">
        <div className="modal-header">
          <h2>Create Campaign</h2>
          <button onClick={onClose} className="close-btn">
            ×
          </button>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Details</div>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Configure</div>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Preview</div>
          </div>
        </div>

        {/* Step 1: Basic Details */}
        {step === 1 && (
          <div className="step-content">
            <div className="form-group">
              <label className="form-label">Campaign Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                placeholder="e.g., Q1 2026 Tech Outreach"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-textarea"
                rows={3}
                placeholder="Campaign goals and notes"
              />
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <div className="step-content">
            <div className="form-group">
              <label className="form-label">Select ICP *</label>
              <select
                value={selectedIcp}
                onChange={(e) => setSelectedIcp(e.target.value)}
                className="form-input"
              >
                <option value="">Choose an ICP...</option>
                {icps.map((icp) => (
                  <option key={icp.id} value={icp.id}>
                    {icp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Email Template *</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="form-input"
              >
                <option value="">Choose a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Minimum ICP Score</label>
                <input
                  type="number"
                  value={minScore}
                  onChange={(e) => setMinScore(parseInt(e.target.value))}
                  className="form-input"
                  min="0"
                  max="100"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Contacts (optional)</label>
                <input
                  type="number"
                  value={maxContacts}
                  onChange={(e) => setMaxContacts(e.target.value)}
                  className="form-input"
                  placeholder="Unlimited"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="step-content">
            <h3 className="section-title">Campaign Preview</h3>
            <p className="section-subtitle">
              Sample personalized emails for {previews.length} contacts
            </p>
            <div className="preview-list">
              {previews.map((preview, i) => (
                <div key={i} className="preview-card">
                  <div className="preview-contact">
                    <strong>{preview.contact_name}</strong>
                    <span className="preview-score">Score: {preview.icp_score}</span>
                  </div>
                  <div className="preview-email">
                    <div className="email-subject">
                      <strong>Subject:</strong> {preview.email_subject}
                    </div>
                    <div className="email-body">{preview.email_body.substring(0, 200)}...</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          {step > 1 && (
            <button onClick={handleBack} className="btn-secondary">
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 2 && (
            <button
              onClick={handleNext}
              disabled={!name}
              className="btn-primary"
            >
              Next
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleCreate}
              disabled={!selectedIcp || !selectedTemplate || loading}
              className="btn-primary"
            >
              {loading ? 'Creating...' : 'Create & Preview'}
            </button>
          )}
          {step === 3 && (
            <button onClick={handleLaunch} className="btn-primary">
              <Play size={16} />
              Launch Campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
