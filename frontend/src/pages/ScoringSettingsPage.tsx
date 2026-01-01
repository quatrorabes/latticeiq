/**
 * ScoringSettingsPage.tsx
 * Configure scoring weights for MDCP, BANT, and SPICE frameworks
 */

import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../api/contacts';
import { colors, gradients, spacing, radius, fontSizes, fontWeights, transitions, shadows } from '../styles/theme';

interface WeightConfig {
  [key: string]: number;
}

interface ScoringWeights {
  mdcp: WeightConfig;
  bant: WeightConfig;
  spice: WeightConfig;
  persona_scores: { [key: string]: number };
  vertical_scores: { [key: string]: number };
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  mdcp: {
    market_fit: 25,
    decision_maker: 30,
    company_profile: 25,
    pain_indicators: 20,
  },
  bant: {
    budget: 25,
    authority: 30,
    need: 25,
    timeline: 20,
  },
  spice: {
    situation: 20,
    pain: 25,
    impact: 20,
    critical_event: 20,
    evaluation: 15,
  },
  persona_scores: {
    "decision-maker": 1.0,
    "champion": 0.85,
    "influencer": 0.7,
    "initiator": 0.6,
    "unknown": 0.5,
  },
  vertical_scores: {
    "finance": 1.0,
    "insurance": 0.95,
    "equipment leasing": 0.9,
    "saas": 0.85,
    "healthcare": 0.8,
    "other": 0.6,
    "unknown": 0.5,
  },
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: '32px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    margin: 0,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    margin: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  card: {
    background: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    border: `1px solid ${colors.borderSubtle}`,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardBadge: {
    fontSize: fontSizes.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: radius.full,
    fontWeight: fontWeights.semibold,
  },
  badgeMdcp: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
  },
  badgeBant: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  badgeSpice: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
  },
  totalBadge: {
    fontSize: fontSizes.sm,
    padding: `${spacing.xs} ${spacing.md}`,
    borderRadius: radius.full,
    fontWeight: fontWeights.bold,
  },
  totalValid: {
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80',
  },
  totalInvalid: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
  },
  weightItem: {
    marginBottom: spacing.md,
  },
  weightLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  weightName: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  weightValue: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.1)',
    outline: 'none',
    cursor: 'pointer',
    WebkitAppearance: 'none',
  },
  cardFull: {
    gridColumn: '1 / -1',
  },
  multiplierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: spacing.xl,
  },
  multiplierSection: {
    
  },
  multiplierTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  multiplierItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.sm} 0`,
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  multiplierName: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  multiplierInput: {
    width: '70px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: `1px solid ${colors.borderMedium}`,
    borderRadius: radius.md,
    padding: `${spacing.xs} ${spacing.sm}`,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    textAlign: 'right',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTop: `1px solid ${colors.borderSubtle}`,
  },
  btnPrimary: {
    background: gradients.accentPrimary,
    color: 'white',
    border: 'none',
    borderRadius: radius.md,
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    boxShadow: shadows.accentSm,
    transition: transitions.normal,
  },
  btnSecondary: {
    background: colors.bgCard,
    color: colors.textSecondary,
    border: `1px solid ${colors.borderMedium}`,
    borderRadius: radius.md,
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    cursor: 'pointer',
    transition: transitions.normal,
  },
  btnDanger: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: radius.md,
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    cursor: 'pointer',
    transition: transitions.normal,
  },
  toast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: 'rgba(34, 197, 94, 0.9)',
    color: 'white',
    padding: `${spacing.md} ${spacing.xl}`,
    borderRadius: radius.lg,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    boxShadow: shadows.lg,
    zIndex: 9999,
    animation: 'slideUp 0.3s ease-out',
  },
  infoBox: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  infoTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: '#60a5fa',
    marginBottom: spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 1.6,
  },
};

// Inject slider styles
const injectSliderStyles = () => {
  const styleId = 'scoring-slider-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    input[type="range"]::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(style);
};

export const ScoringSettingsPage: React.FC = () => {
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    injectSliderStyles();
    loadWeights();
  }, []);

  const loadWeights = async () => {
    try {
      const token = await getAuthToken();
      const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
      
      const res = await fetch(`${API_BASE}/api/v3/settings/scoring-weights`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setWeights(data);
      }
    } catch (err) {
      console.error('Failed to load weights:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveWeights = async () => {
    setSaving(true);
    try {
      const token = await getAuthToken();
      const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
      
      const res = await fetch(`${API_BASE}/api/v3/settings/scoring-weights`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(weights),
      });
      
      if (res.ok) {
        showToast('✓ Scoring weights saved!');
      } else {
        showToast('Failed to save weights');
      }
    } catch (err) {
      showToast('Error saving weights');
    } finally {
      setSaving(false);
    }
  };

  const resetWeights = async () => {
    if (!confirm('Reset all scoring weights to defaults?')) return;
    
    try {
      const token = await getAuthToken();
      const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
      
      const res = await fetch(`${API_BASE}/api/v3/settings/scoring-weights/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setWeights(data.weights);
        showToast('✓ Weights reset to defaults');
      }
    } catch (err) {
      showToast('Error resetting weights');
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const updateWeight = (framework: 'mdcp' | 'bant' | 'spice', key: string, value: number) => {
    setWeights(prev => ({
      ...prev,
      [framework]: {
        ...prev[framework],
        [key]: value,
      },
    }));
  };

  const updateMultiplier = (type: 'persona_scores' | 'vertical_scores', key: string, value: number) => {
    setWeights(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: value,
      },
    }));
  };

  const getTotal = (framework: WeightConfig) => {
    return Object.values(framework).reduce((sum, val) => sum + val, 0);
  };

  const formatLabel = (key: string) => {
    return key.replace(/_/g, ' ').replace(/-/g, ' ');
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', padding: '100px', color: colors.textMuted }}>
          Loading scoring settings...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>🎯 Scoring Settings</h1>
        <p style={styles.subtitle}>Configure how contacts are scored with MDCP, BANT, and SPICE frameworks</p>
      </div>

      <div style={styles.infoBox}>
        <div style={styles.infoTitle}>
          <span>💡</span> How Scoring Works
        </div>
        <div style={styles.infoText}>
          Each framework (MDCP, BANT, SPICE) calculates a score from 0-100. Weights determine how much each factor 
          contributes to the total. <strong>Weights should add up to 100</strong> for each framework. 
          Persona and vertical multipliers affect how much weight is given based on the contact's role and industry.
        </div>
      </div>

      <div style={styles.grid}>
        {/* MDCP Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              <span style={{...styles.cardBadge, ...styles.badgeMdcp}}>MDCP</span>
              Market Fit
            </h3>
            <span style={{
              ...styles.totalBadge,
              ...(getTotal(weights.mdcp) === 100 ? styles.totalValid : styles.totalInvalid)
            }}>
              {getTotal(weights.mdcp)}%
            </span>
          </div>
          
          {Object.entries(weights.mdcp).map(([key, value]) => (
            <div key={key} style={styles.weightItem}>
              <div style={styles.weightLabel}>
                <span style={styles.weightName}>{formatLabel(key)}</span>
                <span style={styles.weightValue}>{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={value}
                onChange={e => updateWeight('mdcp', key, parseInt(e.target.value))}
                style={styles.slider}
              />
            </div>
          ))}
        </div>

        {/* BANT Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              <span style={{...styles.cardBadge, ...styles.badgeBant}}>BANT</span>
              Sales Ready
            </h3>
            <span style={{
              ...styles.totalBadge,
              ...(getTotal(weights.bant) === 100 ? styles.totalValid : styles.totalInvalid)
            }}>
              {getTotal(weights.bant)}%
            </span>
          </div>
          
          {Object.entries(weights.bant).map(([key, value]) => (
            <div key={key} style={styles.weightItem}>
              <div style={styles.weightLabel}>
                <span style={styles.weightName}>{formatLabel(key)}</span>
                <span style={styles.weightValue}>{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={value}
                onChange={e => updateWeight('bant', key, parseInt(e.target.value))}
                style={styles.slider}
              />
            </div>
          ))}
        </div>

        {/* SPICE Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              <span style={{...styles.cardBadge, ...styles.badgeSpice}}>SPICE</span>
              Pain Points
            </h3>
            <span style={{
              ...styles.totalBadge,
              ...(getTotal(weights.spice) === 100 ? styles.totalValid : styles.totalInvalid)
            }}>
              {getTotal(weights.spice)}%
            </span>
          </div>
          
          {Object.entries(weights.spice).map(([key, value]) => (
            <div key={key} style={styles.weightItem}>
              <div style={styles.weightLabel}>
                <span style={styles.weightName}>{formatLabel(key)}</span>
                <span style={styles.weightValue}>{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={value}
                onChange={e => updateWeight('spice', key, parseInt(e.target.value))}
                style={styles.slider}
              />
            </div>
          ))}
        </div>

        {/* Multipliers Card */}
        <div style={{...styles.card, ...styles.cardFull}}>
          <h3 style={styles.cardTitle}>
            <span>⚡</span> Score Multipliers
          </h3>
          <p style={{ color: colors.textMuted, fontSize: fontSizes.sm, marginBottom: spacing.lg }}>
            These multipliers adjust scores based on persona type and industry vertical (0.0 - 1.0)
          </p>
          
          <div style={styles.multiplierGrid}>
            <div style={styles.multiplierSection}>
              <div style={styles.multiplierTitle}>
                <span>👤</span> Persona Multipliers
              </div>
              {Object.entries(weights.persona_scores).map(([key, value]) => (
                <div key={key} style={styles.multiplierItem}>
                  <span style={styles.multiplierName}>{formatLabel(key)}</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value}
                    onChange={e => updateMultiplier('persona_scores', key, parseFloat(e.target.value) || 0)}
                    style={styles.multiplierInput}
                  />
                </div>
              ))}
            </div>
            
            <div style={styles.multiplierSection}>
              <div style={styles.multiplierTitle}>
                <span>🏭</span> Vertical Multipliers
              </div>
              {Object.entries(weights.vertical_scores).map(([key, value]) => (
                <div key={key} style={styles.multiplierItem}>
                  <span style={styles.multiplierName}>{formatLabel(key)}</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value}
                    onChange={e => updateMultiplier('vertical_scores', key, parseFloat(e.target.value) || 0)}
                    style={styles.multiplierInput}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        <button style={styles.btnDanger} onClick={resetWeights}>
          Reset to Defaults
        </button>
        <button style={styles.btnSecondary} onClick={loadWeights}>
          Cancel
        </button>
        <button 
          style={styles.btnPrimary} 
          onClick={saveWeights}
          disabled={saving}
        >
          {saving ? '⏳ Saving...' : '💾 Save Changes'}
        </button>
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
};

export default ScoringSettingsPage;
