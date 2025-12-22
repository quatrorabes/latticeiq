import React, { useState } from 'react';

interface MDCPConfigState {
  money_weight: number;
  decision_maker_weight: number;
  champion_weight: number;
  process_weight: number;
  hot_threshold: number;
  warm_threshold: number;
  money_min_revenue: number;
  money_max_revenue: number;
  decision_maker_titles: string[];
  champion_engagement_days: number;
  process_days: number;
}

interface MDCPConfigProps {
  onSave?: (config: MDCPConfigState) => Promise<void>;
  initialConfig?: Partial<MDCPConfigState>;
}

export const MDCPConfig: React.FC<MDCPConfigProps> = ({
  onSave,
  initialConfig
}) => {
  const [config, setConfig] = useState<MDCPConfigState>({
    money_weight: initialConfig?.money_weight ?? 25,
    decision_maker_weight: initialConfig?.decision_maker_weight ?? 25,
    champion_weight: initialConfig?.champion_weight ?? 25,
    process_weight: initialConfig?.process_weight ?? 25,
    hot_threshold: initialConfig?.hot_threshold ?? 71,
    warm_threshold: initialConfig?.warm_threshold ?? 40,
    money_min_revenue: initialConfig?.money_min_revenue ?? 1_000_000,
    money_max_revenue: initialConfig?.money_max_revenue ?? 10_000_000_000,
    decision_maker_titles: initialConfig?.decision_maker_titles ?? ['CEO', 'CTO', 'CFO', 'COO', 'VP', 'President', 'Founder', 'Head of'],
    champion_engagement_days: initialConfig?.champion_engagement_days ?? 30,
    process_days: initialConfig?.process_days ?? 90
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate total weight
  const totalWeight = config.money_weight + config.decision_maker_weight + config.champion_weight + config.process_weight;
  const weightIsValid = totalWeight === 100;

  // Auto-balance weights
  const handleWeightChange = (
    key: keyof Pick<MDCPConfigState, 'money_weight' | 'decision_maker_weight' | 'champion_weight' | 'process_weight'>,
    value: number
  ) => {
    const weights = {
      'money_weight': config.money_weight,
      'decision_maker_weight': config.decision_maker_weight,
      'champion_weight': config.champion_weight,
      'process_weight': config.process_weight
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

  const handleAddTitle = (title: string) => {
    if (!title.trim()) return;

    setConfig(prev => ({
      ...prev,
      decision_maker_titles: [...prev.decision_maker_titles, title.trim()]
    }));
  };

  const handleRemoveTitle = (index: number) => {
    setConfig(prev => ({
      ...prev,
      decision_maker_titles: prev.decision_maker_titles.filter((_, i) => i !== index)
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
        localStorage.setItem('mdcp_config', JSON.stringify(config));
      }

      setSaveMessage({ type: 'success', message: 'MDCP configuration saved successfully!' });
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
      money_weight: 25,
      decision_maker_weight: 25,
      champion_weight: 25,
      process_weight: 25,
      hot_threshold: 71,
      warm_threshold: 40,
      money_min_revenue: 1_000_000,
      money_max_revenue: 10_000_000_000,
      decision_maker_titles: ['CEO', 'CTO', 'CFO', 'COO', 'VP', 'President', 'Founder', 'Head of'],
      champion_engagement_days: 30,
      process_days: 90
    });
    setSaveMessage(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

  return (
    <div className="space-y-6 p-6 bg-background rounded-lg border border-border-primary">
      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">MDCP Scoring Configuration</h2>
        <p className="text-text-secondary">
          Configure the MDCP framework: Money, Decision-maker, Champion, Process for sales qualification.
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
          {/* Money Weight */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Money (M) - 0 to {config.money_weight} points</label>
              <div className="text-2xl font-bold text-green-400">{config.money_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.money_weight}
              onChange={(e) => handleWeightChange('money_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-green-500"
            />
            <p className="text-xs text-text-muted">
              Points for company having sufficient budget to purchase your solution
            </p>

            {/* Revenue Range */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border-primary">
              <div>
                <label className="block text-xs text-text-secondary mb-2">Min Revenue</label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.money_min_revenue}
                    onChange={(e) => setConfig(prev => ({ ...prev, money_min_revenue: parseInt(e.target.value) }))}
                    className="w-full bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm font-mono focus:border-primary-400 outline-none"
                  />
                  <div className="text-xs text-text-muted mt-1">{formatCurrency(config.money_min_revenue)}</div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-2">Max Revenue</label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.money_max_revenue}
                    onChange={(e) => setConfig(prev => ({ ...prev, money_max_revenue: parseInt(e.target.value) }))}
                    className="w-full bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm font-mono focus:border-primary-400 outline-none"
                  />
                  <div className="text-xs text-text-muted mt-1">{formatCurrency(config.money_max_revenue)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Decision-Maker Weight */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Decision-Maker (D) - 0 to {config.decision_maker_weight} points</label>
              <div className="text-2xl font-bold text-blue-400">{config.decision_maker_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.decision_maker_weight}
              onChange={(e) => handleWeightChange('decision_maker_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-blue-500"
            />
            <p className="text-xs text-text-muted">
              Points for contact having authority to make purchase decisions
            </p>

            {/* Decision-Maker Titles */}
            <div className="mt-4 pt-4 border-t border-border-primary">
              <label className="block text-xs text-text-secondary mb-3 font-semibold">Target Decision-Maker Titles</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Add title (e.g., VP Sales, CTO)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTitle((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="flex-1 bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm focus:border-primary-400 outline-none"
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    handleAddTitle(input.value);
                    input.value = '';
                  }}
                  className="px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-base text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.decision_maker_titles.map((title, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-full px-3 py-1 text-sm text-primary-400"
                  >
                    <span>{title}</span>
                    <button
                      onClick={() => handleRemoveTitle(idx)}
                      className="ml-1 text-primary-500 hover:text-primary-300 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Champion Weight */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Champion (C) - 0 to {config.champion_weight} points</label>
              <div className="text-2xl font-bold text-purple-400">{config.champion_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.champion_weight}
              onChange={(e) => handleWeightChange('champion_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-purple-500"
            />
            <p className="text-xs text-text-muted">
              Points for contact who will advocate internally (engagement signal)
            </p>

            {/* Engagement Days */}
            <div className="mt-4 pt-4 border-t border-border-primary">
              <label className="block text-xs text-text-secondary mb-2 font-semibold">Champion Engagement Window (Days)</label>
              <input
                type="number"
                value={config.champion_engagement_days}
                onChange={(e) => setConfig(prev => ({ ...prev, champion_engagement_days: parseInt(e.target.value) }))}
                className="w-full bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm font-mono focus:border-primary-400 outline-none"
              />
              <p className="text-xs text-text-muted mt-2">
                Contact enriched within {config.champion_engagement_days} days = champion (signal of interest)
              </p>
            </div>
          </div>

          {/* Process Weight */}
          <div className="space-y-3 pt-6 border-t border-border-primary">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Process (P) - 0 to {config.process_weight} points</label>
              <div className="text-2xl font-bold text-orange-400">{config.process_weight}</div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.process_weight}
              onChange={(e) => handleWeightChange('process_weight', parseInt(e.target.value))}
              className="w-full h-2 bg-secondary-border rounded-full appearance-none cursor-pointer accent-orange-500"
            />
            <p className="text-xs text-text-muted">
              Points for being in active deal cycle (implementation window)
            </p>

            {/* Process Timeline */}
            <div className="mt-4 pt-4 border-t border-border-primary">
              <label className="block text-xs text-text-secondary mb-2 font-semibold">Deal Cycle Window (Days)</label>
              <input
                type="number"
                value={config.process_days}
                onChange={(e) => setConfig(prev => ({ ...prev, process_days: parseInt(e.target.value) }))}
                className="w-full bg-background border border-border-primary rounded-base px-3 py-2 text-text-primary text-sm font-mono focus:border-primary-400 outline-none"
              />
              <p className="text-xs text-text-muted mt-2">
                Contact in active process within {config.process_days} days
              </p>
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
                <span className="font-mono text-xs">money_weight</span>
                <div className="font-semibold text-text-primary">{config.money_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">decision_maker_weight</span>
                <div className="font-semibold text-text-primary">{config.decision_maker_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">champion_weight</span>
                <div className="font-semibold text-text-primary">{config.champion_weight}</div>
              </div>
              <div>
                <span className="font-mono text-xs">process_weight</span>
                <div className="font-semibold text-text-primary">{config.process_weight}</div>
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
        <p className="font-semibold">ℹ️ MDCP Framework Notes:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Best for quick sales qualification decisions</li>
          <li>Accuracy: 85% with quick enrich data</li>
          <li>Focus on companies with proven revenue and engaged decision-makers</li>
          <li>Equal weight distribution (25% each) is the standard baseline</li>
          <li>Adjust weights based on your average deal characteristics</li>
        </ul>
      </div>
    </div>
  );
};

export default MDCPConfig;