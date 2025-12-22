import React, { useState, useEffect } from 'react';
import MDCPConfig from './MDCPConfig';
import BANTConfig from './BANTConfig';
import SPICEConfig from './SPICEConfig';

// Assuming APEX has same interface as MDCP
interface APEXConfigState {
  affinity_weight: number;
  pain_weight: number;
  execution_weight: number;
  expert_weight: number;
  hot_threshold: number;
  warm_threshold: number;
  target_verticals: string[];
  pain_keywords: string[];
  company_sizes: string[];
  expert_titles: string[];
}

type ConfigTab = 'apex' | 'mdcp' | 'bant' | 'spice';

interface ScoringConfigPageProps {
  onSave?: (framework: string, config: any) => Promise<void>;
}

export const ScoringConfigPage: React.FC<ScoringConfigPageProps> = ({ onSave }) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('apex');
  const [loading, setLoading] = useState(true);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Simulate loading configs from API
    setTimeout(() => setLoading(false), 500);
  }, []);

  const handleSave = async (framework: string, config: any) => {
    try {
      if (onSave) {
        await onSave(framework, config);
      }
      
      setGlobalMessage({
        type: 'success',
        message: `${framework.toUpperCase()} configuration saved successfully!`
      });

      setTimeout(() => setGlobalMessage(null), 3000);
    } catch (error) {
      setGlobalMessage({
        type: 'error',
        message: `Error saving ${framework} configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">Scoring Configuration</h1>
          <p className="text-text-secondary">
            Configure your preferred lead scoring frameworks to automatically qualify and tier your contacts.
          </p>
        </div>

        {/* Global Message */}
        {globalMessage && (
          <div className={`p-4 rounded-base border ${
            globalMessage.type === 'success'
              ? 'bg-green-950/30 border-green-500/50 text-green-400'
              : 'bg-red-950/30 border-red-500/50 text-red-400'
          }`}>
            {globalMessage.message}
          </div>
        )}

        {/* Framework Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              id: 'apex' as ConfigTab,
              name: 'APEX',
              description: 'Affinity, Pain, eXecution, eXpert',
              accuracy: '85%',
              best_for: 'Quick qualification'
            },
            {
              id: 'mdcp' as ConfigTab,
              name: 'MDCP',
              description: 'Money, Decision-maker, Champion, Process',
              accuracy: '85%',
              best_for: 'Sales cycles'
            },
            {
              id: 'bant' as ConfigTab,
              name: 'BANT',
              description: 'Budget, Authority, Need, Timeline',
              accuracy: '76%',
              best_for: 'Enterprise deals'
            },
            {
              id: 'spice' as ConfigTab,
              name: 'SPICE',
              description: 'Situation, Problem, Implication, Consequence, Economic',
              accuracy: '50-85%',
              best_for: 'Complex solutions'
            }
          ].map(framework => (
            <button
              key={framework.id}
              onClick={() => setActiveTab(framework.id)}
              className={`p-4 rounded-base border transition-all text-left ${
                activeTab === framework.id
                  ? 'bg-primary-500/20 border-primary-500 shadow-lg'
                  : 'bg-secondary-bg border-border-primary hover:border-primary-500/50'
              }`}
            >
              <div className="font-bold text-text-primary mb-1">{framework.name}</div>
              <div className="text-xs text-text-muted mb-2">{framework.description}</div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Accuracy: {framework.accuracy}</span>
                <span className="text-primary-400 font-semibold">→</span>
              </div>
            </button>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 bg-secondary-bg rounded-base border border-border-primary p-1">
          {[
            { id: 'apex' as ConfigTab, label: 'APEX' },
            { id: 'mdcp' as ConfigTab, label: 'MDCP' },
            { id: 'bant' as ConfigTab, label: 'BANT' },
            { id: 'spice' as ConfigTab, label: 'SPICE' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 rounded-base font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Config Content */}
        <div className="min-h-[600px]">
          {activeTab === 'apex' && (
            <APEXConfigComponent onSave={(config) => handleSave('apex', config)} />
          )}
          {activeTab === 'mdcp' && (
            <MDCPConfig onSave={(config) => handleSave('mdcp', config)} />
          )}
          {activeTab === 'bant' && (
            <BANTConfig onSave={(config) => handleSave('bant', config)} />
          )}
          {activeTab === 'spice' && (
            <SPICEConfig onSave={(config) => handleSave('spice', config)} />
          )}
        </div>

        {/* Framework Guide */}
        <div className="mt-12 pt-8 border-t border-border-primary">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Framework Guide</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                name: 'APEX',
                description: 'Fast, lightweight scoring for quick lead assessment',
                when: 'Use when you need quick decisions',
                factors: ['Affinity (vertical fit)', 'Pain (problem match)', 'eXecution (budget proxy)', 'eXpert (title level)'],
                accuracy: '85% with quick enrich'
              },
              {
                name: 'MDCP',
                description: 'Sales-focused scoring emphasizing decision-maker and engagement',
                when: 'Use in ongoing sales cycles',
                factors: ['Money (revenue)', 'Decision-maker (authority)', 'Champion (engagement)', 'Process (stage)'],
                accuracy: '85% with quick enrich'
              },
              {
                name: 'BANT',
                description: 'Enterprise-focused framework for complex B2B deals',
                when: 'Use for enterprise/large deals',
                factors: ['Budget (purchasing power)', 'Authority (decision rights)', 'Need (pain points)', 'Timeline (urgency)'],
                accuracy: '76% with quick enrich'
              },
              {
                name: 'SPICE',
                description: 'Consultative approach for complex solution selling',
                when: 'Use for complex B2B solutions',
                factors: ['Situation (context)', 'Problem (challenge)', 'Implication (impact)', 'Consequence (risk)', 'Economic (financial)'],
                accuracy: '50-85% (improves with Phase 2)'
              }
            ].map(framework => (
              <div key={framework.name} className="bg-secondary-bg rounded-base border border-border-primary p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-2">{framework.name}</h3>
                <p className="text-sm text-text-secondary mb-4">{framework.description}</p>
                
                <div className="mb-4 p-3 bg-background rounded-base">
                  <p className="text-xs text-text-muted mb-1">
                    <span className="font-semibold text-text-secondary">When to use:</span> {framework.when}
                  </p>
                  <p className="text-xs text-text-muted">
                    <span className="font-semibold text-text-secondary">Accuracy:</span> {framework.accuracy}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-secondary">Factors:</p>
                  <ul className="space-y-1">
                    {framework.factors.map((factor, idx) => (
                      <li key={idx} className="text-xs text-text-muted flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="mt-8 p-6 bg-blue-950/20 border border-blue-500/30 rounded-base text-blue-400 space-y-3">
          <h3 className="font-bold text-lg">💡 Implementation Tips</h3>
          <ul className="space-y-2 text-sm">
            <li>• <span className="font-semibold">Start with APEX or MDCP</span> - They work well with basic enrichment data</li>
            <li>• <span className="font-semibold">Tune thresholds</span> - Adjust hot/warm thresholds based on your conversion rates</li>
            <li>• <span className="font-semibold">Test multiple frameworks</span> - See which correlates best with your deals</li>
            <li>• <span className="font-semibold">Layer frameworks</span> - Use multiple scores to get a holistic view</li>
            <li>• <span className="font-semibold">Monitor accuracy</span> - Track which tiers actually convert to measure ROI</li>
            <li>• <span className="font-semibold">Customize keywords</span> - Add industry-specific terms for better accuracy</li>
            <li>• <span className="font-semibold">Use Phase 2 enrichment</span> - SPICE improves from 50% to 85% accuracy with deep research</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// APEX Config Component (Basic implementation)
const APEXConfigComponent: React.FC<{ onSave: (config: any) => Promise<void> }> = ({ onSave }) => {
  const [config, setConfig] = useState({
    affinity_weight: 25,
    pain_weight: 25,
    execution_weight: 25,
    expert_weight: 25,
    hot_threshold: 71,
    warm_threshold: 40,
    target_verticals: ['SaaS', 'Tech', 'Software', 'B2B'],
    pain_keywords: ['growth', 'scale', 'efficiency', 'automation', 'revenue', 'speed'],
    company_sizes: ['50-200', '200-500', '500-1000', '1000+'],
    expert_titles: ['VP', 'Director', 'C-level', 'Chief', 'Head of', 'President', 'Founder']
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(config);
    } finally {
      setIsSaving(false);
    }
  };

  const totalWeight = config.affinity_weight + config.pain_weight + config.execution_weight + config.expert_weight;
  const weightIsValid = totalWeight === 100;

  return (
    <div className="bg-secondary-bg rounded-base border border-border-primary p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">APEX Scoring Configuration</h2>
        <p className="text-text-secondary">
          Configure the APEX framework: Affinity, Pain, eXecution, eXpert for quick lead qualification.
        </p>
      </div>

      <div className="bg-background rounded-base border border-border-primary p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-text-primary">Weight Distribution</h3>
          <div className={`text-sm font-mono ${weightIsValid ? 'text-green-500' : 'text-red-500'}`}>
            Total: {totalWeight}%
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: 'affinity_weight', label: 'Affinity (A)', description: 'Industry/vertical fit' },
            { key: 'pain_weight', label: 'Pain (P)', description: 'Problem resonance' },
            { key: 'execution_weight', label: 'eXecution (E)', description: 'Budget capability' },
            { key: 'expert_weight', label: 'eXpert (X)', description: 'Decision-maker quality' }
          ].map(({ key, label, description }) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-semibold text-text-primary">{label}</span>
                  <p className="text-xs text-text-muted">{description}</p>
                </div>
                <div className="text-2xl font-bold text-primary-400">{(config as any)[key]}</div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={(config as any)[key]}
                onChange={(e) => {
                  setConfig(prev => ({
                    ...prev,
                    [key]: parseInt(e.target.value)
                  }));
                }}
                className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-primary-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-background rounded-base border border-border-primary p-4">
          <label className="block text-xs text-text-secondary mb-2 font-semibold">Hot Threshold</label>
          <input
            type="range"
            min="0"
            max="100"
            value={config.hot_threshold}
            onChange={(e) => setConfig(prev => ({ ...prev, hot_threshold: parseInt(e.target.value) }))}
            className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-red-500"
          />
          <div className="text-2xl font-bold text-red-500 mt-2">{config.hot_threshold}</div>
        </div>

        <div className="bg-background rounded-base border border-border-primary p-4">
          <label className="block text-xs text-text-secondary mb-2 font-semibold">Warm Threshold</label>
          <input
            type="range"
            min="0"
            max={config.hot_threshold}
            value={config.warm_threshold}
            onChange={(e) => setConfig(prev => ({ ...prev, warm_threshold: parseInt(e.target.value) }))}
            className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-yellow-500"
          />
          <div className="text-2xl font-bold text-yellow-500 mt-2">{config.warm_threshold}</div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!weightIsValid || isSaving}
        className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-base transition-colors"
      >
        {isSaving ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  );
};

export default ScoringConfigPage;