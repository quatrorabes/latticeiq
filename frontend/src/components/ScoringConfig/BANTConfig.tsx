// frontend/src/components/ScoringConfig/BANTConfig.tsx

import React, { useState, useEffect } from 'react';
import WeightSlider from "../../Common/WeightSlider";
import { getScoringConfig, saveScoringConfig } from '../../api/scoring';

interface BANTConfig {
  weights: {
    budget: number;
    authority: number;
    need: number;
    timeline: number;
  };
  thresholds: {
    hotMin: number;
    warmMin: number;
  };
  config: {
    budgetMin: number;
    budgetMax: number;
    authorityTitles: string[];
    needKeywords: string[];
    timelineDays: number;
  };
}

const AUTHORITY_TITLES = [
  'CEO', 'VP', 'Director', 'Manager', 'C-Level', 'Executive',
  'Head of', 'Chief', 'President', 'Owner',
];

export const BANTConfig: React.FC = () => {
  const [config, setConfig] = useState<BANTConfig>({
    weights: {
      budget: 25,
      authority: 25,
      need: 25,
      timeline: 25,
    },
    thresholds: {
      hotMin: 71,
      warmMin: 40,
    },
    config: {
      budgetMin: 50000,
      budgetMax: 5000000,
      authorityTitles: ['VP', 'Director', 'C-Level'],
      needKeywords: ['growth', 'scale', 'automate', 'efficiency', 'cost'],
      timelineDays: 90,
    },
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getScoringConfig('bant');
      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (framework: keyof BANTConfig['weights'], value: number) => {
    setConfig((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        [framework]: value,
      },
    }));
  };

  const handleThresholdChange = (threshold: keyof BANTConfig['thresholds'], value: number) => {
    setConfig((prev) => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [threshold]: value,
      },
    }));
  };

  const handleConfigChange = (key: keyof BANTConfig['config'], value: any) => {
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
        authorityTitles: prev.config.authorityTitles.includes(title)
          ? prev.config.authorityTitles.filter((t) => t !== title)
          : [...prev.config.authorityTitles, title],
      },
    }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !config.config.needKeywords.includes(newKeyword.trim())) {
      setConfig((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          needKeywords: [...prev.config.needKeywords, newKeyword.trim()],
        },
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setConfig((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        needKeywords: prev.config.needKeywords.filter((k) => k !== keyword),
      },
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await saveScoringConfig('bant', config);
      setMessage({ type: 'success', text: 'BANT configuration saved!' });
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">BANT Scoring</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Budget, Authority, Need, Timeline - Best for enterprise deals
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
          label="Budget"
          value={config.weights.budget}
          onChange={(v) => handleWeightChange('budget', v)}
          description="Has adequate budget allocated for your solution?"
        />

        <WeightSlider
          label="Authority"
          value={config.weights.authority}
          onChange={(v) => handleWeightChange('authority', v)}
          description="Is this person a decision-maker with budget authority?"
        />

        <WeightSlider
          label="Need"
          value={config.weights.need}
          onChange={(v) => handleWeightChange('need', v)}
          description="Have they expressed specific pain points you solve?"
        />

        <WeightSlider
          label="Timeline"
          value={config.weights.timeline}
          onChange={(v) => handleWeightChange('timeline', v)}
          description="When do they need to solve their problem?"
        />
      </div>

      {/* Configuration Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Configuration
        </h3>

        {/* Budget Range */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Budget Range
          </label>
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="number"
                value={config.config.budgetMin}
                onChange={(e) =>
                  handleConfigChange('budgetMin', Number(e.target.value))
                }
                placeholder="Min budget"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum</p>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={config.config.budgetMax}
                onChange={(e) =>
                  handleConfigChange('budgetMax', Number(e.target.value))
                }
                placeholder="Max budget"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum</p>
            </div>
          </div>
        </div>

        {/* Authority Titles */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Authority Titles (select all that apply)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AUTHORITY_TITLES.map((title) => (
              <button
                key={title}
                onClick={() => toggleTitle(title)}
                className={`px-3 py-2 rounded text-sm font-medium transition ${
                  config.config.authorityTitles.includes(title)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        {/* Need Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Need Keywords (pain points you solve)
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="Add keyword (e.g., 'growth')"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              onClick={addKeyword}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.config.needKeywords.map((keyword) => (
              <div
                key={keyword}
                className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Expected Sales Cycle (days)
          </label>
          <input
            type="number"
            value={config.config.timelineDays}
            onChange={(e) =>
              handleConfigChange('timelineDays', Number(e.target.value))
            }
            min="1"
            max="365"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Expected days to close</p>
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

export default BANTConfig;
