import React, { useState, useEffect } from 'react';
import { Target, RotateCcw, Save, TrendingUp } from 'lucide-react';
import '../styles/ScoringPage.css';

interface ScoringWeights {
  mdcp: {
    market_fit: number;
    decision_maker: number;
    company_profile: number;
    pain_indicators: number;
  };
  bant: {
    budget: number;
    authority: number;
    need: number;
    timeline: number;
  };
  spice: {
    situation: number;
    pain: number;
    impact: number;
    critical_event: number;
    evaluation: number;
  };
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  mdcp: {
    market_fit: 25,
    decision_maker: 30,
    company_profile: 25,
    pain_indicators: 20
  },
  bant: {
    budget: 25,
    authority: 30,
    need: 25,
    timeline: 20
  },
  spice: {
    situation: 20,
    pain: 25,
    impact: 20,
    critical_event: 20,
    evaluation: 15
  }
};

export const ScoringPage: React.FC = () => {
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [activeFramework, setActiveFramework] = useState<'mdcp' | 'bant' | 'spice'>('mdcp');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateWeight = (framework: keyof ScoringWeights, field: string, value: number) => {
    setWeights(prev => ({
      ...prev,
      [framework]: {
        ...prev[framework],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const getTotalWeight = (framework: keyof ScoringWeights) => {
    return Object.values(weights[framework]).reduce((sum, val) => sum + val, 0);
  };

  const resetToDefaults = () => {
    setWeights(DEFAULT_WEIGHTS);
    setHasChanges(true);
  };

  const saveWeights = async () => {
    setSaving(true);
    try {
      // In production: await fetch('/api/v3/settings/scoring-weights', { method: 'PUT', body: JSON.stringify(weights) });
      await new Promise(resolve => setTimeout(resolve, 1000));
      setHasChanges(false);
      alert('Scoring weights saved successfully!');
    } catch (err) {
      console.error('Failed to save weights:', err);
    } finally {
      setSaving(false);
    }
  };

  const renderWeightSlider = (framework: keyof ScoringWeights, field: string, label: string) => {
    const value = weights[framework][field as keyof typeof weights[typeof framework]];
    
    return (
      <div className="weight-control" key={field}>
        <div className="weight-header">
          <label>{label}</label>
          <span className="weight-value">{value}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => updateWeight(framework, field, parseInt(e.target.value))}
          className="weight-slider"
        />
      </div>
    );
  };

  const total = getTotalWeight(activeFramework);
  const isValidTotal = total === 100;

  return (
    <div className="scoring-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-main">
          <Target size={32} />
          <div>
            <h1>Scoring Settings</h1>
            <p>Customize framework weights to match your sales criteria</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={resetToDefaults}>
            <RotateCcw size={20} />
            Reset to Defaults
          </button>
          <button
            className="btn-primary"
            onClick={saveWeights}
            disabled={!hasChanges || !isValidTotal || saving}
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Framework Tabs */}
      <div className="framework-tabs">
        <button
          className={`framework-tab ${activeFramework === 'mdcp' ? 'active' : ''}`}
          onClick={() => setActiveFramework('mdcp')}
        >
          <div className="tab-content">
            <span className="tab-icon">🎯</span>
            <div>
              <div className="tab-name">MDCP Framework</div>
              <div className="tab-description">Market, Decision-maker, Company, Pain</div>
            </div>
          </div>
          <div className={`tab-total ${getTotalWeight('mdcp') === 100 ? 'valid' : 'invalid'}`}>
            {getTotalWeight('mdcp')}%
          </div>
        </button>

        <button
          className={`framework-tab ${activeFramework === 'bant' ? 'active' : ''}`}
          onClick={() => setActiveFramework('bant')}
        >
          <div className="tab-content">
            <span className="tab-icon">💰</span>
            <div>
              <div className="tab-name">BANT Framework</div>
              <div className="tab-description">Budget, Authority, Need, Timeline</div>
            </div>
          </div>
          <div className={`tab-total ${getTotalWeight('bant') === 100 ? 'valid' : 'invalid'}`}>
            {getTotalWeight('bant')}%
          </div>
        </button>

        <button
          className={`framework-tab ${activeFramework === 'spice' ? 'active' : ''}`}
          onClick={() => setActiveFramework('spice')}
        >
          <div className="tab-content">
            <span className="tab-icon">🌶️</span>
            <div>
              <div className="tab-name">SPICE Framework</div>
              <div className="tab-description">Situation, Pain, Impact, Critical Event, Evaluation</div>
            </div>
          </div>
          <div className={`tab-total ${getTotalWeight('spice') === 100 ? 'valid' : 'invalid'}`}>
            {getTotalWeight('spice')}%
          </div>
        </button>
      </div>

      {/* Weight Controls */}
      <div className="weights-container">
        <div className="weights-card">
          <div className="card-header">
            <h2>{activeFramework.toUpperCase()} Weights</h2>
            {!isValidTotal && (
              <span className="warning-badge">
                ⚠️ Total must equal 100% (currently {total}%)
              </span>
            )}
          </div>

          <div className="weights-grid">
            {activeFramework === 'mdcp' && (
              <>
                {renderWeightSlider('mdcp', 'market_fit', 'Market Fit')}
                {renderWeightSlider('mdcp', 'decision_maker', 'Decision Maker')}
                {renderWeightSlider('mdcp', 'company_profile', 'Company Profile')}
                {renderWeightSlider('mdcp', 'pain_indicators', 'Pain Indicators')}
              </>
            )}

            {activeFramework === 'bant' && (
              <>
                {renderWeightSlider('bant', 'budget', 'Budget')}
                {renderWeightSlider('bant', 'authority', 'Authority')}
                {renderWeightSlider('bant', 'need', 'Need')}
                {renderWeightSlider('bant', 'timeline', 'Timeline')}
              </>
            )}

            {activeFramework === 'spice' && (
              <>
                {renderWeightSlider('spice', 'situation', 'Situation')}
                {renderWeightSlider('spice', 'pain', 'Pain')}
                {renderWeightSlider('spice', 'impact', 'Impact')}
                {renderWeightSlider('spice', 'critical_event', 'Critical Event')}
                {renderWeightSlider('spice', 'evaluation', 'Evaluation')}
              </>
            )}
          </div>

          <div className="weights-summary">
            <div className="summary-item">
              <TrendingUp size={20} />
              <div>
                <div className="summary-label">Total Weight</div>
                <div className={`summary-value ${isValidTotal ? 'valid' : 'invalid'}`}>
                  {total}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="info-panel">
          <h3>ℹ️ Scoring Guide</h3>
          
          {activeFramework === 'mdcp' && (
            <div className="info-content">
              <p><strong>Market Fit:</strong> How well the contact matches your ideal customer profile</p>
              <p><strong>Decision Maker:</strong> Authority level and buying power</p>
              <p><strong>Company Profile:</strong> Company size, revenue, and growth indicators</p>
              <p><strong>Pain Indicators:</strong> Urgency and alignment with your solution</p>
            </div>
          )}

          {activeFramework === 'bant' && (
            <div className="info-content">
              <p><strong>Budget:</strong> Financial capacity to purchase</p>
              <p><strong>Authority:</strong> Decision-making power</p>
              <p><strong>Need:</strong> Problem severity and solution fit</p>
              <p><strong>Timeline:</strong> Urgency to implement</p>
            </div>
          )}

          {activeFramework === 'spice' && (
            <div className="info-content">
              <p><strong>Situation:</strong> Current state and challenges</p>
              <p><strong>Pain:</strong> Problem intensity and impact</p>
              <p><strong>Impact:</strong> Value of solving the problem</p>
              <p><strong>Critical Event:</strong> Catalysts driving change</p>
              <p><strong>Evaluation:</strong> Buying process maturity</p>
            </div>
          )}

          <div className="info-tip">
            💡 <strong>Tip:</strong> Adjust weights based on your sales process. Higher weights mean more influence on the overall score.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoringPage;
