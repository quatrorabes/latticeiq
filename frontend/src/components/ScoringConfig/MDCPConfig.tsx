// frontend/src/components/ScoringConfig/MDCPConfig.tsx

import React, { useState, useEffect } from 'react';
import WeightSlider from "../../Common/WeightSlider";
import { getScoringConfig, saveScoringConfig } from '../../api/scoring';

interface MDCPConfig {
  weights: {
    money: number;
    decisionmaker: number;
    champion: number;
    process: number;
  };
  thresholds: {
    hotMin: number;
    warmMin: number;
  };
  config: {
    moneyMinRevenue: number;
    moneyMaxRevenue: number;
    decisionmakerTitles: string[];
    championEngagementDays: number;
    processDays: number;
  };
}

const DECISION_MAKER_TITLES = [
  'CEO', 'CTO', 'VP Sales', 'CMO', 'CFO', 'VP Marketing',
  'VP Operations', 'VP Engineering', 'President', 'Director',
];

export const MDCPConfig: React.FC = () => {
  const [config, setConfig] = useState<MDCPConfig>({
    weights: {
      money: 25,
      decisionmaker: 25,
      champion: 25,
      process: 25,
    },
    thresholds: {
      hotMin: 71,
      warmMin: 40,
    },
    config: {
      moneyMinRevenue: 1000000,
      moneyMaxRevenue: 100000000,
      decisionmakerTitles: ['CEO', 'VP Sales', 'CMO'],
      championEngagementDays: 30,
      processDays: 90,
    },
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getScoringConfig('mdcp');
      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (framework: keyof MDCPConfig['weights'], value: number) => {
    setConfig((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        [framework]: value,
      },
    }));
  };

  const handleThresholdChange = (threshold: keyof MDCPConfig['thresholds'], value: number) => {
    setConfig((prev) => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [threshold]: value,
      },
    }));
  };

  const handleConfigChange = (key: keyof MDCPConfig['config'], value: any) => {
    setConfig((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }));
  };

  const toggleTitle = (title: string) => {
    setConfig((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        decisionmakerTitles: prev.config.decisionmakerTitles.includes(title)
          ? prev.config.decisionmakerTitles.filter((t) => t !== title)
          : [...prev.config.decisionmakerTitles, title],
      },
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await saveScoringConfig('mdcp', config);
      setMessage({ type: 'success', text: 'MDCP configuration saved!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
      console.error('Save error:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalWeights = Object.values(config.weights).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MDCP Scoring</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Money, Decision-maker, Champion, Process - Best for sales qualification
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Weights Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Scoring Weights
          </h3>
          <div className="flex items-center gap-2">
            <div
              className={`text-sm font-medium ${
                totalWeights === 100 ? 'text-green-600' : 'text-orange-600'
              }`}
            >
              Total: {totalWeights}%
            </div>
            {totalWeights !== 100 && (
              <span className="text-xs text-gray-500">(should equal 100%)</span>
            )}
          </div>
        </div>

        <WeightSlider
          label="Money / Budget Match"
          value={config.weights.money}
          onChange={(v) => handleWeightChange('money', v)}
          description="Does company revenue match your target range?"
        />

        <WeightSlider
          label="Decision-Maker"
          value={config.weights.decisionmaker}
          onChange={(v) => handleWeightChange('decisionmaker', v)}
          description="Is this person an identified decision-maker?"
        />

        <WeightSlider
          label="Champion / Advocate"
          value={config.weights.champion}
          onChange={(v) => handleWeightChange('champion', v)}
          description="Have they recently engaged with you (last N days)?"
        />

        <WeightSlider
          label="Process / Timeline"
          value={config.weights.process}
          onChange={(v) => handleWeightChange('process', v)}
          description="Is there an active deal or buying cycle?"
        />
      </div>

      {/* Configuration Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Configuration
        </h3>

        {/* Revenue Range */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Target Annual Revenue Range
          </label>
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="number"
                value={config.config.moneyMinRevenue}
                onChange={(e) =>
                  handleConfigChange('moneyMinRevenue', Number(e.target.value))
                }
                placeholder="Min revenue"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum</p>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={config.config.moneyMaxRevenue}
                onChange={(e) =>
                  handleConfigChange('moneyMaxRevenue', Number(e.target.value))
                }
                placeholder="Max revenue"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum</p>
            </div>
          </div>
        </div>

        {/* Decision-Maker Titles */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Decision-Maker Titles (select all that apply)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DECISION_MAKER_TITLES.map((title) => (
              <button
                key={title}
                onClick={() => toggleTitle(title)}
                className={`px-3 py-2 rounded text-sm font-medium transition ${
                  config.config.decisionmakerTitles.includes(title)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        {/* Engagement Windows */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Champion Engagement Window (days)
            </label>
            <input
              type="number"
              value={config.config.championEngagementDays}
              onChange={(e) =>
                handleConfigChange('championEngagementDays', Number(e.target.value))
              }
              min="1"
              max="365"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last engagement</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Process Timeline (days)
            </label>
            <input
              type="number"
              value={config.config.processDays}
              onChange={(e) =>
                handleConfigChange('processDays', Number(e.target.value))
              }
              min="1"
              max="365"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Expected deal close</p>
          </div>
        </div>
      </div>

      {/* Thresholds Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          Tier Thresholds
        </h3>

        <WeightSlider
          label="Hot Threshold (minimum)"
          value={config.thresholds.hotMin}
          onChange={(v) => handleThresholdChange('hotMin', v)}
          description="Scores at or above this are marked as Hot"
        />

        <WeightSlider
          label="Warm Threshold (minimum)"
          value={config.thresholds.warmMin}
          onChange={(v) => handleThresholdChange('warmMin', v)}
          description="Scores at or above this are marked as Warm"
        />

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-900 dark:text-blue-200">
          <p className="font-semibold mb-2">Tier Classification:</p>
          <ul className="space-y-1 text-xs">
            <li>🔴 <strong>Hot:</strong> Score ≥ {config.thresholds.hotMin}</li>
            <li>🟠 <strong>Warm:</strong> Score {config.thresholds.warmMin} - {config.thresholds.hotMin - 1}</li>
            <li>❄️ <strong>Cold:</strong> Score &lt; {config.thresholds.warmMin}</li>
          </ul>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
        <button
          onClick={loadConfig}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium rounded-lg transition"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default MDCPConfig;
