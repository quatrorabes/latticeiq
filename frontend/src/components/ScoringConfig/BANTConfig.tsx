import React, { useState, useEffect } from 'react';

interface BANTConfigState {
  budget_weight: number;
  authority_weight: number;
  need_weight: number;
  timeline_weight: number;
  hot_threshold: number;
  warm_threshold: number;
  budget_min: number;
  budget_max: number;
  authority_titles: string[];
  need_keywords: string[];
  timeline_urgency: string[];
}

interface BANTConfigProps {
  onSave?: (config: BANTConfigState) => Promise<void>;
  initialConfig?: Partial<BANTConfigState>;
}

export const BANTConfig: React.FC<BANTConfigProps> = ({
  onSave,
  initialConfig
}) => {
  const [config, setConfig] = useState<BANTConfigState>({
    budget_weight: initialConfig?.budget_weight ?? 25,
    authority_weight: initialConfig?.authority_weight ?? 25,
    need_weight: initialConfig?.need_weight ?? 25,
    timeline_weight: initialConfig?.timeline_weight ?? 25,
    hot_threshold: initialConfig?.hot_threshold ?? 71,
    warm_threshold: initialConfig?.warm_threshold ?? 40,
    budget_min: initialConfig?.budget_min ?? 50_000,
    budget_max: initialConfig?.budget_max ?? 100_000_000,
    authority_titles: initialConfig?.authority_titles ?? ['VP', 'Director', 'C-level', 'Chief', 'President', 'Head of'],
    need_keywords: initialConfig?.need_keywords ?? ['growth', 'scale', 'efficiency', 'automation', 'revenue', 'challenge'],
    timeline_urgency: initialConfig?.timeline_urgency ?? ['immediate', 'urgent', 'soon', 'asap', 'this quarter']
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate total weight
  const totalWeight = config.budget_weight + config.authority_weight + config.need_weight + config.timeline_weight;
  const weightIsValid = totalWeight === 100;

  // Auto-balance weights when one changes
  const handleWeightChange = (key: keyof Pick<BANTConfigState, 'budget_weight' | 'authority_weight' | 'need_weight' | 'timeline_weight'>, value: number) => {
    const weights = {
      'budget_weight': config.budget_weight,
      'authority_weight': config.authority_weight,
      'need_weight': config.need_weight,
      'timeline_weight': config.timeline_weight
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

  const handleAddKeyword = (type: 'authority_titles' | 'need_keywords' | 'timeline_urgency', keyword: string) => {
    if (!keyword.trim()) return;

    setConfig(prev => ({
      ...prev,
      [type]: [...prev[type], keyword.trim()]
    }));
  };

  const handleRemoveKeyword = (type: 'authority_titles' | 'need_keywords' | 'timeline_urgency', index: number) => {
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
        // Default save to localStorage for demo
        localStorage.setItem('bant_config', JSON.stringify(config));
      }

      setSaveMessage({ type: 'success', message: 'BANT configuration saved successfully!' });
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
      budget_weight: 25,
      authority_weight: 25,
      need_weight: 25,
      timeline_weight: 25,
      hot_threshold: 71,
      warm_threshold: 40,
      budget_min: 50_000,
      budget_max: 100_000_000,
      authority_titles: ['VP', 'Director', 'C-level', 'Chief', 'President', 'Head of'],
      need_keywords: ['growth', 'scale', 'efficiency', 'automation', 'revenue', 'challenge'],
      timeline_urgency: ['immediate', 'urgent', 'soon', 'asap', 'this quarter']
    });
    setSaveMessage(null);
  };

  return (
    <div className="space-y-6 p-6 bg-background rounded-lg border border-border-primary">
      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">BANT Scoring Configuration</h2>
        <p className="text-text-secondary">
          Configure the BANT framework: Budget, Authority, Need, Timeline for enterprise deal qualification.
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

      {/* Weight Distribution Section */}
      <div className="bg-secondary-bg rounded-base border border-border-primary p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-text-primary">Weight Distribution</h3>
          <div className={`text-sm font-mono ${weightIsValid ? 'text-green-500' : 'text-red-500'}`}>
            Total: {totalWeight}%
          </div>
        </div>

        <div className="space-y-6">
          {/* Budget Weight */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Budget (B) - 0 to {config.budget_weight} points</label>
              <div className="text-2xl font-bold text-primary-400">{config.budget_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.budget_weight}
              onChange={(e) => handleWeightChange('budget_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-text-muted">
              Points for company having sufficient budget to purchase your solution
            </p>

            {/* Budget Range */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border-primary">
              <div>
                <label className="block text-xs text-text-secondary mb-2">Min Budget ($)</label>
                <input
                  type="number"
                  value={config.budget_min}
                  onChange={(e) => setConfig(prev => ({ ...prev, budget_min: parseInt(e.target.value) }))}
                  className="w-full bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm font-mono focus:border-primary-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-2">Max Budget ($)</label>
                <input
                  type="number"
                  value={config.budget_max}
                  onChange={(e) => setConfig(prev => ({ ...prev, budget_max: parseInt(e.target.value) }))}
                  className="w-full bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm font-mono focus:border-primary-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Authority Weight */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Authority (A) - 0 to {config.authority_weight} points</label>
              <div className="text-2xl font-bold text-primary-400">{config.authority_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.authority_weight}
              onChange={(e) => handleWeightChange('authority_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-text-muted">
              Points for contact having decision-making authority
            </p>

            {/* Authority Titles */}
            <div className="mt-4 pt-4 border-t border-border-primary">
              <label className="block text-xs text-text-secondary mb-3 font-semibold">Authority Titles</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Add title (e.g., VP, C-level)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddKeyword('authority_titles', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1 bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm focus:border-primary-400 outline-none"
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    handleAddKeyword('authority_titles', input.value);
                    input.value = '';
                  }}
                  className="px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-base text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.authority_titles.map((title, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-full px-3 py-1 text-sm text-primary-400"
                  >
                    <span>{title}</span>
                    <button
                      onClick={() => handleRemoveKeyword('authority_titles', idx)}
                      className="ml-1 text-primary-500 hover:text-primary-300 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Need Weight */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Need (N) - 0 to {config.need_weight} points</label>
              <div className="text-2xl font-bold text-primary-400">{config.need_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.need_weight}
              onChange={(e) => handleWeightChange('need_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-text-muted">
              Points for having identified need/pain point we solve
            </p>

            {/* Need Keywords */}
            <div className="mt-4 pt-4 border-t border-border-primary">
              <label className="block text-xs text-text-secondary mb-3 font-semibold">Need Keywords</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Add keyword (e.g., growth, efficiency)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddKeyword('need_keywords', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1 bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm focus:border-primary-400 outline-none"
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    handleAddKeyword('need_keywords', input.value);
                    input.value = '';
                  }}
                  className="px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-base text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.need_keywords.map((keyword, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-full px-3 py-1 text-sm text-primary-400"
                  >
                    <span>{keyword}</span>
                    <button
                      onClick={() => handleRemoveKeyword('need_keywords', idx)}
                      className="ml-1 text-primary-500 hover:text-primary-300 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline Weight */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Timeline (T) - 0 to {config.timeline_weight} points</label>
              <div className="text-2xl font-bold text-primary-400">{config.timeline_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.timeline_weight}
              onChange={(e) => handleWeightChange('timeline_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-text-muted">
              Points for urgency signals indicating near-term buying timeline
            </p>

            {/* Timeline Urgency Keywords */}
            <div className="mt-4 pt-4 border-t border-border-primary">
              <label className="block text-xs text-text-secondary mb-3 font-semibold">Urgency Keywords</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Add urgency (e.g., immediate, this quarter)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddKeyword('timeline_urgency', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1 bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm focus:border-primary-400 outline-none"
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    handleAddKeyword('timeline_urgency', input.value);
                    input.value = '';
                  }}
                  className="px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-base text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.timeline_urgency.map((urgency, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-full px-3 py-1 text-sm text-primary-400"
                  >
                    <span>{urgency}</span>
                    <button
                      onClick={() => handleRemoveKeyword('timeline_urgency', idx)}
                      className="ml-1 text-primary-500 hover:text-primary-300 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Threshold Section */}
      <div className="bg-secondary-bg rounded-base border border-border-primary p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-6">Lead Quality Thresholds</h3>

        <div className="space-y-6">
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
              Score of {config.hot_threshold}+ = Hot lead (strong fit, ready to engage)
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
              Score of {config.warm_threshold}-{config.hot_threshold - 1} = Warm lead (potential fit, needs more info)
            </p>
          </div>

          {/* Tier Distribution */}
          <div className="pt-6 border-t border-border-primary">
            <p className="text-xs text-text-secondary mb-3 font-semibold">Tier Distribution:</p>
            <div className="space-y-2 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Hot: {config.hot_threshold}-100</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Warm: {config.warm_threshold}-{config.hot_threshold - 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Cold: 0-{config.warm_threshold - 1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                <span className="font-mono text-xs">budget_weight</span>
                <div className="font-semibold text-text-primary">{config.budget_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">authority_weight</span>
                <div className="font-semibold text-text-primary">{config.authority_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">need_weight</span>
                <div className="font-semibold text-text-primary">{config.need_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">timeline_weight</span>
                <div className="font-semibold text-text-primary">{config.timeline_weight}</div>
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
    </div>
  );
};

export default BANTConfig;