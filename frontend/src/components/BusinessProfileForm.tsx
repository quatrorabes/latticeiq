import React, { useState, useEffect } from 'react';
import { 
  Building2, Target, Sparkles, Users, Award, Plus, X, 
  Save, Loader2, CheckCircle, AlertCircle, User, Mail, 
  Calendar, MessageSquare
} from 'lucide-react';
import { 
  BusinessProfile, CaseStudy, 
  getBusinessProfile, saveBusinessProfile 
} from '../api/outreach';
import '../styles/BusinessProfileForm.css';

interface Props {
  onSave?: (profile: BusinessProfile) => void;
}

const defaultProfile: Omit<BusinessProfile, 'id' | 'is_default' | 'created_at' | 'updated_at'> = {
  company_name: '',
  tagline: '',
  what_you_do: '',
  target_audience: '',
  primary_value_prop: '',
  unique_approach: '',
  key_features: [],
  case_studies: [],
  notable_clients: [],
  tone: 'professional',
  sender_name: '',
  sender_title: '',
  sender_email: '',
  calendar_link: '',
};

export const BusinessProfileForm: React.FC<Props> = ({ onSave }) => {
  const [profile, setProfile] = useState(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Feature input
  const [newFeature, setNewFeature] = useState('');
  // Client input
  const [newClient, setNewClient] = useState('');
  // Case study form
  const [newCaseStudy, setNewCaseStudy] = useState<CaseStudy>({ client: '', result: '', metric: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { profile: existingProfile } = await getBusinessProfile();
      if (existingProfile) {
        setProfile({
          company_name: existingProfile.company_name || '',
          tagline: existingProfile.tagline || '',
          what_you_do: existingProfile.what_you_do || '',
          target_audience: existingProfile.target_audience || '',
          primary_value_prop: existingProfile.primary_value_prop || '',
          unique_approach: existingProfile.unique_approach || '',
          key_features: existingProfile.key_features || [],
          case_studies: existingProfile.case_studies || [],
          notable_clients: existingProfile.notable_clients || [],
          tone: existingProfile.tone || 'professional',
          sender_name: existingProfile.sender_name || '',
          sender_title: existingProfile.sender_title || '',
          sender_email: existingProfile.sender_email || '',
          calendar_link: existingProfile.calendar_link || '',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!profile.company_name.trim()) {
      setMessage({ type: 'error', text: 'Company name is required' });
      return;
    }
    if (!profile.what_you_do.trim() || profile.what_you_do.length < 10) {
      setMessage({ type: 'error', text: 'Please describe what you do (at least 10 characters)' });
      return;
    }
    if (!profile.target_audience.trim() || profile.target_audience.length < 10) {
      setMessage({ type: 'error', text: 'Please describe your target audience (at least 10 characters)' });
      return;
    }
    if (!profile.primary_value_prop.trim() || profile.primary_value_prop.length < 10) {
      setMessage({ type: 'error', text: 'Please add your primary value proposition (at least 10 characters)' });
      return;
    }

    setSaving(true);
    setMessage(null);
    
    try {
      const result = await saveBusinessProfile(profile);
      setMessage({ type: 'success', text: 'Business profile saved successfully!' });
      onSave?.(result.profile);
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    if (newFeature.trim() && !profile.key_features.includes(newFeature.trim())) {
      setProfile({ ...profile, key_features: [...profile.key_features, newFeature.trim()] });
      setNewFeature('');
    }
  };

  const removeFeature = (feature: string) => {
    setProfile({ ...profile, key_features: profile.key_features.filter(f => f !== feature) });
  };

  const addClient = () => {
    if (newClient.trim() && !profile.notable_clients.includes(newClient.trim())) {
      setProfile({ ...profile, notable_clients: [...profile.notable_clients, newClient.trim()] });
      setNewClient('');
    }
  };

  const removeClient = (client: string) => {
    setProfile({ ...profile, notable_clients: profile.notable_clients.filter(c => c !== client) });
  };

  const addCaseStudy = () => {
    if (newCaseStudy.client.trim() && newCaseStudy.result.trim()) {
      setProfile({ ...profile, case_studies: [...profile.case_studies, { ...newCaseStudy }] });
      setNewCaseStudy({ client: '', result: '', metric: '' });
    }
  };

  const removeCaseStudy = (index: number) => {
    setProfile({ ...profile, case_studies: profile.case_studies.filter((_, i) => i !== index) });
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <Loader2 className="spin" size={32} />
        <p>Loading business profile...</p>
      </div>
    );
  }

  const completionScore = calculateCompletionScore(profile);

  return (
    <div className="business-profile-form">
      {/* Header */}
      <div className="profile-header">
        <div className="header-content">
          <h2>Business Profile</h2>
          <p>Configure your "What We Do Best" profile for AI-powered email generation</p>
        </div>
        <div className="completion-badge" data-score={completionScore >= 80 ? 'high' : completionScore >= 50 ? 'medium' : 'low'}>
          <span className="score">{completionScore}%</span>
          <span className="label">Complete</span>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Form Sections */}
      <div className="form-sections">
        
        {/* Section 1: Company Identity */}
        <section className="form-section">
          <div className="section-header">
            <Building2 size={20} />
            <h3>Company Identity</h3>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>Company Name <span className="required">*</span></label>
              <input
                type="text"
                value={profile.company_name}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>
            <div className="form-field">
              <label>Tagline</label>
              <input
                type="text"
                value={profile.tagline || ''}
                onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                placeholder="Making work easier, one click at a time"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Value Proposition (Required) */}
        <section className="form-section highlight">
          <div className="section-header">
            <Sparkles size={20} />
            <h3>Value Proposition</h3>
            <span className="badge required-badge">Required for AI</span>
          </div>
          
          <div className="form-field full-width">
            <label>What You Do <span className="required">*</span></label>
            <textarea
              value={profile.what_you_do}
              onChange={(e) => setProfile({ ...profile, what_you_do: e.target.value })}
              placeholder="We help [WHO] achieve [OUTCOME] by [HOW]. Example: We help commercial real estate brokers close deals 40% faster by automating property research and client outreach."
              rows={3}
            />
            <span className="char-count">{profile.what_you_do.length}/500</span>
          </div>
          
          <div className="form-field full-width">
            <label>Target Audience <span className="required">*</span></label>
            <textarea
              value={profile.target_audience}
              onChange={(e) => setProfile({ ...profile, target_audience: e.target.value })}
              placeholder="Who is your ideal customer? Be specific. Example: VP of Sales at B2B SaaS companies with 50-500 employees who are struggling with outbound prospecting."
              rows={2}
            />
          </div>
          
          <div className="form-field full-width">
            <label>Primary Value Proposition <span className="required">*</span></label>
            <textarea
              value={profile.primary_value_prop}
              onChange={(e) => setProfile({ ...profile, primary_value_prop: e.target.value })}
              placeholder="What's the #1 benefit you provide? Be specific and measurable if possible. Example: Cut prospecting time by 80% while doubling reply rates."
              rows={2}
            />
          </div>
          
          <div className="form-field full-width">
            <label>Unique Approach</label>
            <textarea
              value={profile.unique_approach || ''}
              onChange={(e) => setProfile({ ...profile, unique_approach: e.target.value })}
              placeholder="What makes you different from competitors? Example: Unlike generic CRMs, we use AI to research every prospect and personalize outreach automatically."
              rows={2}
            />
          </div>
        </section>

        {/* Section 3: Key Features */}
        <section className="form-section">
          <div className="section-header">
            <Target size={20} />
            <h3>Key Features</h3>
          </div>
          <div className="tags-container">
            {profile.key_features.map((feature) => (
              <span key={feature} className="tag">
                {feature}
                <button onClick={() => removeFeature(feature)}><X size={14} /></button>
              </span>
            ))}
          </div>
          <div className="add-tag-row">
            <input
              type="text"
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
              placeholder="Add a key feature..."
            />
            <button onClick={addFeature} className="btn-add">
              <Plus size={16} /> Add
            </button>
          </div>
        </section>

        {/* Section 4: Social Proof */}
        <section className="form-section">
          <div className="section-header">
            <Award size={20} />
            <h3>Social Proof</h3>
          </div>
          
          {/* Case Studies */}
          <div className="subsection">
            <h4>Case Studies</h4>
            {profile.case_studies.length > 0 && (
              <div className="case-studies-list">
                {profile.case_studies.map((cs, index) => (
                  <div key={index} className="case-study-card">
                    <div className="cs-content">
                      <strong>{cs.client}</strong>
                      <p>{cs.result}</p>
                      {cs.metric && <span className="cs-metric">{cs.metric}</span>}
                    </div>
                    <button onClick={() => removeCaseStudy(index)} className="btn-remove">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="case-study-form">
              <input
                type="text"
                value={newCaseStudy.client}
                onChange={(e) => setNewCaseStudy({ ...newCaseStudy, client: e.target.value })}
                placeholder="Client name (e.g., River City Bank)"
              />
              <input
                type="text"
                value={newCaseStudy.result}
                onChange={(e) => setNewCaseStudy({ ...newCaseStudy, result: e.target.value })}
                placeholder="Result achieved (e.g., Reduced loan processing time by 50%)"
              />
              <input
                type="text"
                value={newCaseStudy.metric || ''}
                onChange={(e) => setNewCaseStudy({ ...newCaseStudy, metric: e.target.value })}
                placeholder="Key metric (e.g., 45 days → 21 days)"
              />
              <button onClick={addCaseStudy} className="btn-add" disabled={!newCaseStudy.client || !newCaseStudy.result}>
                <Plus size={16} /> Add Case Study
              </button>
            </div>
          </div>
          
          {/* Notable Clients */}
          <div className="subsection">
            <h4>Notable Clients</h4>
            <div className="tags-container">
              {profile.notable_clients.map((client) => (
                <span key={client} className="tag client-tag">
                  {client}
                  <button onClick={() => removeClient(client)}><X size={14} /></button>
                </span>
              ))}
            </div>
            <div className="add-tag-row">
              <input
                type="text"
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addClient())}
                placeholder="Add a notable client..."
              />
              <button onClick={addClient} className="btn-add">
                <Plus size={16} /> Add
              </button>
            </div>
          </div>
        </section>

        {/* Section 5: Tone & Style */}
        <section className="form-section">
          <div className="section-header">
            <MessageSquare size={20} />
            <h3>Email Tone</h3>
          </div>
          <div className="tone-options">
            {['professional', 'friendly', 'casual', 'bold'].map((tone) => (
              <button
                key={tone}
                className={`tone-btn ${profile.tone === tone ? 'active' : ''}`}
                onClick={() => setProfile({ ...profile, tone: tone as any })}
              >
                {tone === 'professional' && '👔'}
                {tone === 'friendly' && '😊'}
                {tone === 'casual' && '👋'}
                {tone === 'bold' && '🔥'}
                <span>{tone.charAt(0).toUpperCase() + tone.slice(1)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Section 6: Sender Info */}
        <section className="form-section">
          <div className="section-header">
            <User size={20} />
            <h3>Sender Information</h3>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label><User size={14} /> Your Name</label>
              <input
                type="text"
                value={profile.sender_name || ''}
                onChange={(e) => setProfile({ ...profile, sender_name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div className="form-field">
              <label>Your Title</label>
              <input
                type="text"
                value={profile.sender_title || ''}
                onChange={(e) => setProfile({ ...profile, sender_title: e.target.value })}
                placeholder="Account Executive"
              />
            </div>
            <div className="form-field">
              <label><Mail size={14} /> Your Email</label>
              <input
                type="email"
                value={profile.sender_email || ''}
                onChange={(e) => setProfile({ ...profile, sender_email: e.target.value })}
                placeholder="john@company.com"
              />
            </div>
            <div className="form-field">
              <label><Calendar size={14} /> Calendar Link</label>
              <input
                type="url"
                value={profile.calendar_link || ''}
                onChange={(e) => setProfile({ ...profile, calendar_link: e.target.value })}
                placeholder="https://calendly.com/yourname"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Save Button */}
      <div className="form-actions">
        <button onClick={handleSave} disabled={saving} className="btn-save">
          {saving ? (
            <>
              <Loader2 size={18} className="spin" /> Saving...
            </>
          ) : (
            <>
              <Save size={18} /> Save Business Profile
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Helper to calculate profile completion
function calculateCompletionScore(profile: typeof defaultProfile): number {
  let score = 0;
  const weights = {
    company_name: 10,
    what_you_do: 20,
    target_audience: 20,
    primary_value_prop: 20,
    unique_approach: 5,
    key_features: 5,
    case_studies: 10,
    sender_name: 5,
    tone: 5,
  };

  if (profile.company_name?.trim()) score += weights.company_name;
  if (profile.what_you_do?.trim() && profile.what_you_do.length >= 20) score += weights.what_you_do;
  if (profile.target_audience?.trim() && profile.target_audience.length >= 20) score += weights.target_audience;
  if (profile.primary_value_prop?.trim() && profile.primary_value_prop.length >= 20) score += weights.primary_value_prop;
  if (profile.unique_approach?.trim()) score += weights.unique_approach;
  if (profile.key_features?.length > 0) score += weights.key_features;
  if (profile.case_studies?.length > 0) score += weights.case_studies;
  if (profile.sender_name?.trim()) score += weights.sender_name;
  if (profile.tone) score += weights.tone;

  return score;
}

export default BusinessProfileForm;
