import React, { useState } from 'react';

interface SPICEConfigState {
  situation_weight: number;
  problem_weight: number;
  implication_weight: number;
  consequence_weight: number;
  economic_weight: number;
  hot_threshold: number;
  warm_threshold: number;
  problem_keywords: string[];
  implication_keywords: string[];
  consequence_keywords: string[];
  economic_keywords: string[];
}

interface SPICEConfigProps {
  onSave?: (config: SPICEConfigState) => Promise<void>;
  initialConfig?: Partial<SPICEConfigState>;
}

export const SPICEConfig: React.FC<SPICEConfigProps> = ({
  onSave,
  initialConfig
}) => {
  const [config, setConfig] = useState<SPICEConfigState>({
    situation_weight: initialConfig?.situation_weight ?? 20,
    problem_weight: initialConfig?.problem_weight ?? 20,
    implication_weight: initialConfig?.implication_weight ?? 20,
    consequence_weight: initialConfig?.consequence_weight ?? 20,
    economic_weight: initialConfig?.economic_weight ?? 20,
    hot_threshold: initialConfig?.hot_threshold ?? 71,
    warm_threshold: initialConfig?.warm_threshold ?? 40,
    problem_keywords: initialConfig?.problem_keywords ?? ['challenge', 'issue', 'problem', 'difficulty', 'pain point', 'struggle'],
    implication_keywords: initialConfig?.implication_keywords ?? ['impact', 'affect', 'consequence', 'result', 'effect'],
    consequence_keywords: initialConfig?.consequence_keywords ?? ['risk', 'critical', 'urgent', 'important', 'mandatory'],
    economic_keywords: initialConfig?.economic_keywords ?? ['revenue', 'cost', 'savings', 'profit', 'margin', 'investment', 'roi']
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'weights' | 'keywords' | 'thresholds'>('weights');

  // Calculate total weight
  const totalWeight = config.situation_weight + config.problem_weight + config.implication_weight + 
                     config.consequence_weight + config.economic_weight;
  const weightIsValid = totalWeight === 100;

  // Auto-balance weights
  const handleWeightChange = (
    key: keyof Pick<SPICEConfigState, 'situation_weight' | 'problem_weight' | 'implication_weight' | 'consequence_weight' | 'economic_weight'>,
    value: number
  ) => {
    const weights = {
      'situation_weight': config.situation_weight,
      'problem_weight': config.problem_weight,
      'implication_weight': config.implication_weight,
      'consequence_weight': config.consequence_weight,
      'economic_weight': config.economic_weight
    } as const;

    const keys = Object.keys(weights) as Array<keyof typeof weights>;
    const currentTotal = Object.values(weights).reduce((a, b) => a + b, 0);
    const difference = 100 - currentTotal;
    const otherKeys = keys.filter(k => k !== key);

    if (otherKeys.length > 0 && difference !== 0) {
      const distributedValue = Math.floor(difference / otherKeys.length);
      const remainder = difference % otherKeys.length;

      const newConfig = { ...config, [key]: value };
      otherKeys.forEach((k, idx) => {
        const current = newConfig[k];
        newConfig[k] = current + distributedValue + (idx < remainder ? 1 : 0);
      });

      setConfig(newConfig);
    } else {
      setConfig(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleAddKeyword = (type: 'problem_keywords' | 'implication_keywords' | 'consequence_keywords' | 'economic_keywords', keyword: string) => {
    if (!keyword.trim()) return;

    setConfig(prev => ({
      ...prev,
      [type]: [...prev[type], keyword.trim()]
    }));
  };

  const handleRemoveKeyword = (type: 'problem_keywords' | 'implication_keywords' | 'consequence_keywords' | 'economic_keywords', index: number) => {
    setConfig(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!weightIsValid) {
      setSaveMessage({ type: 'error', message: 'Weights must total 100%' });
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage(null);

      if (onSave) {
        await onSave(config);
      } else {
        localStorage.setItem('spice_config', JSON.stringify(config));
      }

      setSaveMessage({ type: 'success', message: 'SPICE configuration saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({
        type: 'error',
        message: `Error saving configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({
      situation_weight: 20,
      problem_weight: 20,
      implication_weight: 20,
      consequence_weight: 20,
      economic_weight: 20,
      hot_threshold: 71,
      warm_threshold: 40,
      problem_keywords: ['challenge', 'issue', 'problem', 'difficulty', 'pain point', 'struggle'],
      implication_keywords: ['impact', 'affect', 'consequence', 'result', 'effect'],
      consequence_keywords: ['risk', 'critical', 'urgent', 'important', 'mandatory'],
      economic_keywords: ['revenue', 'cost', 'savings', 'profit', 'margin', 'investment', 'roi']
    });
    setSaveMessage(null);
  };

  const KeywordSection = ({ 
    label, 
    description, 
    type, 
    keywords 
  }: { 
    label: string; 
    description: string; 
    type: 'problem_keywords' | 'implication_keywords' | 'consequence_keywords' | 'economic_keywords';
    keywords: string[];
  }) => {
    const [inputValue, setInputValue] = useState('');

    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1">{label}</label>
          <p className="text-xs text-text-muted">{description}</p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddKeyword(type, inputValue);
                setInputValue('');
              }
            }}
            placeholder={`Add ${label.toLowerCase()}...`}
            className="flex-1 bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm focus:border-primary-400 outline-none"
          />
          <button
            onClick={() => {
              handleAddKeyword(type, inputValue);
              setInputValue('');
            }}
            className="px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-base text-sm font-medium transition-colors"
          >
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-full px-3 py-1 text-sm text-primary-400"
            >
              <span>{keyword}</span>
              <button
                onClick={() => handleRemoveKeyword(type, idx)}
                className="ml-1 text-primary-500 hover:text-primary-300 font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6 bg-background rounded-lg border border-border-primary">
      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">SPICE Scoring Configuration</h2>
        <p className="text-text-secondary">
          Configure the SPICE framework: Situation, Problem, Implication, Consequence, Economic for complex solutions.
          <span className="block text-xs text-text-muted mt-1">
            💡 Note: SPICE works best with Phase 2 deep enrichment. With quick enrich, expect 50% accuracy.
          </span>
        </p>
      </div>

      {saveMessage && (
        <div className={`p-4 rounded-base border ${
          saveMessage.type === 'success'
            ? 'bg-green-950/30 border-green-500/50 text-green-400'
            : 'bg-red-950/30 border-red-500/50 text-red-400'
        }`}>
          {saveMessage.message}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-secondary-bg rounded-base border border-border-primary p-1">
        <button
          onClick={() => setActiveTab('weights')}
          className={`flex-1 px-4 py-2 rounded-base font-semibold transition-colors ${
            activeTab === 'weights'
              ? 'bg-primary-500 text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Weights
        </button>
        <button
          onClick={() => setActiveTab('keywords')}
          className={`flex-1 px-4 py-2 rounded-base font-semibold transition-colors ${
            activeTab === 'keywords'
              ? 'bg-primary-500 text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Keywords
        </button>
        <button
          onClick={() => setActiveTab('thresholds')}
          className={`flex-1 px-4 py-2 rounded-base font-semibold transition-colors ${
            activeTab === 'thresholds'
              ? 'bg-primary-500 text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Thresholds
        </button>
      </div>

      {/* Weights Tab */}
      {activeTab === 'weights' && (
        <div className="bg-secondary-bg rounded-base border border-border-primary p-6 space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-text-primary">Weight Distribution</h3>
            <div className={`text-sm font-mono ${weightIsValid ? 'text-green-500' : 'text-red-500'}`}>
              Total: {totalWeight}%
            </div>
          </div>

          {/* Situation */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Situation (S) - 0 to {config.situation_weight} points</label>
              <div className="text-2xl font-bold text-blue-400">{config.situation_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.situation_weight}
              onChange={(e) => handleWeightChange('situation_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-blue-500"
            />
            <p className="text-xs text-text-muted">
              Points for understanding the company's current situation and context
            </p>
          </div>

          {/* Problem */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Problem (P) - 0 to {config.problem_weight} points</label>
              <div className="text-2xl font-bold text-purple-400">{config.problem_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.problem_weight}
              onChange={(e) => handleWeightChange('problem_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-purple-500"
            />
            <p className="text-xs text-text-muted">
              Points for identifying specific problems or challenges they face
            </p>
          </div>

          {/* Implication */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Implication (I) - 0 to {config.implication_weight} points</label>
              <div className="text-2xl font-bold text-cyan-400">{config.implication_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.implication_weight}
              onChange={(e) => handleWeightChange('implication_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-xs text-text-muted">
              Points for understanding implications of problems (business impact)
            </p>
          </div>

          {/* Consequence */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Consequence (C) - 0 to {config.consequence_weight} points</label>
              <div className="text-2xl font-bold text-orange-400">{config.consequence_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.consequence_weight}
              onChange={(e) => handleWeightChange('consequence_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-orange-500"
            />
            <p className="text-xs text-text-muted">
              Points for understanding risk and consequences of inaction
            </p>
          </div>

          {/* Economic */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Economic (E) - 0 to {config.economic_weight} points</label>
              <div className="text-2xl font-bold text-green-400">{config.economic_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.economic_weight}
              onChange={(e) => handleWeightChange('economic_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-green-500"
            />
            <p className="text-xs text-text-muted">
              Points for quantifying financial impact or budget allocation
            </p>
          </div>
        </div>
      )}

      {/* Keywords Tab */}
      {activeTab === 'keywords' && (
        <div className="bg-secondary-bg rounded-base border border-border-primary p-6 space-y-6">
          <h3 className="text-lg font-semibold text-text-primary">Keyword Configuration</h3>

          <KeywordSection
            label="Problem Keywords"
            description="Keywords that indicate a problem or challenge exists"
            type="problem_keywords"
            keywords={config.problem_keywords}
          />

          <div className="pt-6 border-t border-border-primary">
            <KeywordSection
              label="Implication Keywords"
              description="Keywords that indicate business impact or consequences"
              type="implication_keywords"
              keywords={config.implication_keywords}
            />
          </div>

          <div className="pt-6 border-t border-border-primary">
            <KeywordSection
              label="Consequence Keywords"
              description="Keywords indicating risk, urgency, or critical importance"
              type="consequence_keywords"
              keywords={config.consequence_keywords}
            />
          </div>

          <div className="pt-6 border-t border-border-primary">
            <KeywordSection
              label="Economic Keywords"
              description="Keywords indicating financial impact or budget relevance"
              type="economic_keywords"
              keywords={config.economic_keywords}
            />
          </div>

          <div className="p-4 bg-background rounded-base border border-border-primary/50 text-xs text-text-muted space-y-2">
            <p className="font-semibold text-text-secondary">💡 Keyword Matching Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Keywords are case-insensitive</li>
              <li>Partial matches work (e.g., "chall" matches "challenge")</li>
              <li>Add industry-specific terms relevant to your solution</li>
              <li>Remove generic terms that reduce accuracy</li>
            </ul>
          </div>
        </div>
      )}

      {/* Thresholds Tab */}
      {activeTab === 'thresholds' && (
        <div className="bg-secondary-bg rounded-base border border-border-primary p-6 space-y-6">
          <h3 className="text-lg font-semibold text-text-primary">Lead Quality Thresholds</h3>

          {/* Hot Threshold */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Hot Threshold (Minimum Score)</label>
              <div className="text-2xl font-bold text-red-500">{config.hot_threshold}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.hot_threshold}
              onChange={(e) => setConfig(prev => ({ ...prev, hot_threshold: parseInt(e.target.value) }))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-red-500"
            />
            <p className="text-xs text-text-muted">
              Score of {config.hot_threshold}+ = Hot lead (excellent fit, high buying intent)
            </p>
          </div>

          {/* Warm Threshold */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Warm Threshold (Minimum Score)</label>
              <div className="text-2xl font-bold text-yellow-500">{config.warm_threshold}</div>
            </div>
            <input
              type="range"
              min="0"
              max={config.hot_threshold}
              value={config.warm_threshold}
              onChange={(e) => setConfig(prev => ({ ...prev, warm_threshold: parseInt(e.target.value) }))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-yellow-500"
            />
            <p className="text-xs text-text-muted">
              Score of {config.warm_threshold}-{config.hot_threshold - 1} = Warm lead (potential fit, needs research)
            </p>
          </div>

          {/* Tier Distribution Visualization */}
          <div className="pt-6 border-t border-border-primary">
            <p className="text-xs text-text-secondary mb-4 font-semibold">Tier Distribution:</p>

            <div className="space-y-4">
              {/* Hot */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                    <span className="text-sm font-semibold text-text-primary">Hot</span>
                  </div>
                  <span className="text-xs text-text-muted">{config.hot_threshold}-100</span>
                </div>
                <div className="w-full bg-secondary-border rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${100 - config.hot_threshold}%` }}
                  />
                </div>
              </div>

              {/* Warm */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-500" />
                    <span className="text-sm font-semibold text-text-primary">Warm</span>
                  </div>
                  <span className="text-xs text-text-muted">{config.warm_threshold}-{config.hot_threshold - 1}</span>
                </div>
                <div className="w-full bg-secondary-border rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-yellow-500 h-full"
                    style={{ width: `${config.hot_threshold - config.warm_threshold}%` }}
                  />
                </div>
              </div>

              {/* Cold */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500" />
                    <span className="text-sm font-semibold text-text-primary">Cold</span>
                  </div>
                  <span className="text-xs text-text-muted">0-{config.warm_threshold - 1}</span>
                </div>
                <div className="w-full bg-secondary-border rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${config.warm_threshold}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Threshold Notes */}
          <div className="p-4 bg-background rounded-base border border-border-primary/50 text-xs text-text-muted space-y-2">
            <p className="font-semibold text-text-secondary">📊 Threshold Tuning:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Raise Hot threshold if you're getting too many false positives</li>
              <li>Lower Warm threshold if leads are too cold to convert</li>
              <li>Monitor actual conversion rates and adjust accordingly</li>
              <li>Different products may need different thresholds</li>
            </ul>
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="bg-secondary-bg rounded-base border border-border-primary p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-primary-400 hover:text-primary-300 font-semibold transition-colors"
        >
          <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
          Advanced Settings
        </button>

        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-border-primary space-y-4 text-sm text-text-muted">
            <div className="grid grid-cols-2 gap-4 p-3 bg-background rounded-base border border-border-primary">
              <div>
                <span className="font-mono text-xs">situation_weight</span>
                <div className="font-semibold text-text-primary">{config.situation_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">problem_weight</span>
                <div className="font-semibold text-text-primary">{config.problem_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">implication_weight</span>
                <div className="font-semibold text-text-primary">{config.implication_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">consequence_weight</span>
                <div className="font-semibold text-text-primary">{config.consequence_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">economic_weight</span>
                <div className="font-semibold text-text-primary">{config.economic_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">hot_threshold</span>
                <div className="font-semibold text-text-primary">{config.hot_threshold}</div>
              </div>
            </div>

            <div className="p-3 bg-background rounded-base border border-border-primary">
              <p className="text-xs text-text-secondary mb-2">Configuration JSON:</p>
              <pre className="text-xs overflow-auto max-h-40 text-primary-400">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-6 border-t border-border-primary">
        <button
          onClick={handleSave}
          disabled={!weightIsValid || isSaving}
          className="flex-1 px-4 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-base transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
        <button
          onClick={handleReset}
          className="flex-1 px-4 py-3 bg-secondary-bg hover:bg-secondary-border border border-border-primary text-text-primary font-semibold rounded-base transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {!weightIsValid && (
        <div className="p-3 bg-red-950/30 border border-red-500/50 rounded-base text-red-400 text-sm">
          ⚠️ Weights must total 100%. Currently: {totalWeight}%
        </div>
      )}

      {/* Information Banner */}
      <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-base text-blue-400 text-xs space-y-2">
        <p className="font-semibold">ℹ️ SPICE Framework Notes:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Works best with Phase 2 deep enrichment (company research, news, funding data)</li>
          <li>With quick enrich only, expect 50% accuracy - improve by adding full enrichment</li>
          <li>Ideal for complex B2B solutions requiring business context</li>
          <li>Equal weight distribution (20% each) is recommended to start</li>
        </ul>
      </div>
    </div>
  );
};

export default SPICEConfig;