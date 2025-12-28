import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ICPSettings {
  [key: string]: number | string | boolean;
}

export default function ScoringPage() {
  const [settings, setSettings] = useState<ICPSettings>({
    // APEX Model Weights
    apex_title_weight: 0.25,
    apex_seniority_weight: 0.25,
    apex_company_size_weight: 0.2,
    apex_vertical_match_weight: 0.3,

    // MDCP Model (Criteria)
    mdcp_budget_threshold: 50000,
    mdcp_timeline_months: 6,
    mdcp_authority_required: true,
    mdcp_need_clearly_defined: true,

    // BANT Model (Qualifying)
    bant_budget_required: true,
    bant_authority_confirmation: 'required',
    bant_need_qualification: 'required',
    bant_timeline_required: true,

    // SPICE Model (Intent Signals)
    spice_engagement_weight: 0.2,
    spice_authority_weight: 0.25,
    spice_company_fit_weight: 0.25,
    spice_implementation_weight: 0.15,
    spice_economic_weight: 0.15,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('icp_settings')
        .select('settings')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        setMessageType('error');
        return;
      }

      const { error } = await supabase.from('icp_settings').upsert(
        {
          user_id: session.user.id,
          settings: settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      setMessage('✅ ICP Settings saved successfully!');
      setMessageType('success');
    } catch (err) {
      setMessage(`Error saving settings: ${(err as Error).message}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  }

  const updateSetting = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading settings...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>⚙️ ICP & Scoring Settings</h1>

      {message && (
        <div
          style={{
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px',
            background: messageType === 'success' ? '#003300' : '#330000',
            color: messageType === 'success' ? '#00ff00' : '#ff0000',
            border: `1px solid ${messageType === 'success' ? '#00ff00' : '#ff0000'}`,
          }}
        >
          {message}
        </div>
      )}

      {/* APEX MODEL */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2 style={{ color: '#0066cc', marginTop: '0' }}>⭐ APEX Scoring Model</h2>
        <p style={{ color: '#999', fontSize: '12px' }}>
          Weights for scoring based on title, seniority, company size, and vertical match
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {[
            { key: 'apex_title_weight', label: 'Job Title Weight', help: 'How much title seniority matters' },
            { key: 'apex_seniority_weight', label: 'Seniority Weight', help: 'How much executive level matters' },
            { key: 'apex_company_size_weight', label: 'Company Size Weight', help: 'How much company size matters' },
            { key: 'apex_vertical_match_weight', label: 'Vertical Match Weight', help: 'How much industry fit matters' },
          ].map((field) => (
            <div key={field.key}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
                {field.label}
              </label>
              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#666' }}>{field.help}</p>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={Number(settings[field.key])}
                onChange={(e) => updateSetting(field.key, parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  background: '#0a0a0a',
                  color: '#fff',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* MDCP MODEL */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2 style={{ color: '#0066cc', marginTop: '0' }}>📊 MDCP Qualification Model</h2>
        <p style={{ color: '#999', fontSize: '12px' }}>
          Money, Decision Maker, Criteria, Process - criteria for sales qualification
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              Budget Threshold ($)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={Number(settings.mdcp_budget_threshold)}
              onChange={(e) => updateSetting('mdcp_budget_threshold', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              Timeline (months)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={Number(settings.mdcp_timeline_months)}
              onChange={(e) => updateSetting('mdcp_timeline_months', parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={Boolean(settings.mdcp_authority_required)}
                onChange={(e) => updateSetting('mdcp_authority_required', e.target.checked)}
              />
              Require Decision Maker Authority
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={Boolean(settings.mdcp_need_clearly_defined)}
                onChange={(e) => updateSetting('mdcp_need_clearly_defined', e.target.checked)}
              />
              Require Clearly Defined Need
            </label>
          </div>
        </div>
      </div>

      {/* BANT MODEL */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2 style={{ color: '#0066cc', marginTop: '0' }}>🎯 BANT Qualification Framework</h2>
        <p style={{ color: '#999', fontSize: '12px' }}>
          Budget, Authority, Need, Timeline - core qualifying criteria
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={Boolean(settings.bant_budget_required)}
                onChange={(e) => updateSetting('bant_budget_required', e.target.checked)}
              />
              Budget Required
            </label>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              Authority Confirmation
            </label>
            <select
              value={String(settings.bant_authority_confirmation)}
              onChange={(e) => updateSetting('bant_authority_confirmation', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            >
              <option>optional</option>
              <option>recommended</option>
              <option>required</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
              Need Qualification
            </label>
            <select
              value={String(settings.bant_need_qualification)}
              onChange={(e) => updateSetting('bant_need_qualification', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#0a0a0a',
                color: '#fff',
              }}
            >
              <option>optional</option>
              <option>recommended</option>
              <option>required</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={Boolean(settings.bant_timeline_required)}
                onChange={(e) => updateSetting('bant_timeline_required', e.target.checked)}
              />
              Timeline Required
            </label>
          </div>
        </div>
      </div>

      {/* SPICE MODEL */}
      <div style={{ marginBottom: '30px', padding: '20px', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2 style={{ color: '#0066cc', marginTop: '0' }}>✨ SPICE Intent Scoring</h2>
        <p style={{ color: '#999', fontSize: '12px' }}>
          Situation, Problem, Implication, Consequence, Environment - weights for intent signals
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {[
            { key: 'spice_engagement_weight', label: 'Engagement Weight', help: 'How much engagement matters' },
            { key: 'spice_authority_weight', label: 'Authority Weight', help: 'How much decision authority matters' },
            { key: 'spice_company_fit_weight', label: 'Company Fit Weight', help: 'How much company fit matters' },
            { key: 'spice_implementation_weight', label: 'Implementation Weight', help: 'How much implementation timeline matters' },
            { key: 'spice_economic_weight', label: 'Economic Weight', help: 'How much ROI/economics matter' },
          ].map((field) => (
            <div key={field.key}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '12px' }}>
                {field.label}
              </label>
              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#666' }}>{field.help}</p>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={Number(settings[field.key])}
                onChange={(e) => updateSetting(field.key, parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  background: '#0a0a0a',
                  color: '#fff',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* SAVE BUTTON */}
      <button
        onClick={saveSettings}
        disabled={saving}
        style={{
          width: '100%',
          padding: '12px',
          background: saving ? '#666' : '#00cc00',
          color: saving ? '#999' : '#000',
          fontWeight: 'bold',
          fontSize: '16px',
          border: 'none',
          borderRadius: '4px',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? '⏳ Saving...' : '💾 Save ICP Settings'}
      </button>

      <div style={{ marginTop: '20px', padding: '15px', background: '#0a0a0a', borderRadius: '4px', fontSize: '12px', color: '#999' }}>
        <p style={{ marginTop: '0' }}>💡 These settings are used to calculate scores for each contact during enrichment.</p>
        <p>Adjust weights to match your ideal customer profile and sales qualification criteria.</p>
      </div>
    </div>
  );
}