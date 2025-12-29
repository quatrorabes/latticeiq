// frontend/src/components/ScoringConfig/SPICEConfig.tsx

import React, { useState, useEffect } from 'react';
import WeightSlider from "../../Common/WeightSlider";
import { getScoringConfig, saveScoringConfig } from '../../api/scoring';

interface SPICEConfig {
  weights: {
    situation: number;
    problem: number;
    implication: number;
    consequence: number;
    economic: number;
  };
  thresholds: {
    hotMin: number;
    warmMin: number;
  };
  config: {
    situationKeywords: string[];
    problemKeywords: string[];
    economicMinValue: number;
  };
}

export const SPICEConfig: React.FC = () => {
  const [config, setConfig] = useState<SPICEConfig>({
    weights: {
      situation: 20,
      problem: 20,
      implication: 20,
      consequence: 20,
      economic: 20,
    },
    thresholds: {
      hotMin: 71,
      warmMin: 40,
    },
    config: {
      situationKeywords: ['industry', 'market', 'competitive', 'transformation'],
      problemKeywords: ['challenge', 'issue', 'pain', 'struggle', 'difficulty'],
      economicMinValue: 100000,
    },
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newSitKeyword, setNewSitKeyword] = useState('');
  const [newProbKeyword, setNewProbKeyword] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getScoringConfig('spice');
      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (framework: keyof SPICEConfig['weights'], value: number) => {
    setConfig((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        [framework]: value,
      },
    }));
  };

  const handleThresholdChange = (threshold: keyof SPICEConfig['thresholds'], value: number) => {
    setConfig((prev) => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [threshold]: value,
      },
    }));
  };

  const addSituationKeyword = () => {
    if (
      newSitKeyword.trim() &&
      !config.config.situationKeywords.includes(newSitKeyword.trim())
    ) {
      setConfig((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          situationKeywords: [...prev.config.situationKeywords, newSitKeyword.trim()],
        },
      }));
      setNewSitKeyword('');
    }
  };

  const removeSituationKeyword = (keyword: string) => {
    setConfig((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        situationKeywords: prev.config.situationKeywords.filter((k) => k !== keyword),
      },
    }));
  };

  const addProblemKeyword = () => {
    if (
      newProbKeyword.trim() &&
      !config.config.problemKeywords.includes(newProbKeyword.trim())
    ) {
      setConfig((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          problemKeywords: [...prev.config.problemKeywords, newProbKeyword.trim()],
        },
      }));
      setNewProbKeyword('');
    }
  };

  const removeProblemKeyword = (keyword: string) => {
    setConfig((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        problemKeywords: prev.config.problemKeywords.filter((k) => k !== keyword),
      },
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await saveScoringConfig('spice', config);
      setMessage({ type: 'success', text: 'SPICE configuration saved!' });
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SPICE Scoring</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Situation, Problem, Implication, Consequence, Economic - Best for complex/custom solutions
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
          label="Situation"
          value={config.weights.situation}
          onChange={(v) => handleWeightChange('situation', v)}
          description="Do they describe their current industry/market situation?"
        />

        <WeightSlider
          label="Problem"
          value={config.weights.problem}
          onChange={(v) => handleWeightChange('problem', v)}
          description="Have they identified a specific problem?"
        />

        <WeightSlider
          label="Implication"
          value={config.weights.implication}
          onChange={(v) => handleWeightChange('implication', v)}
          description="Do they understand the impact of not solving it?"
        />

        <WeightSlider
          label="Consequence"
          value={config.weights.consequence}
          onChange={(v) => handleWeightChange('consequence', v)}
          description="How urgent/critical is this problem?"
        />

        <WeightSlider
          label="Economic"
          value={config.weights.economic}
          onChange={(v) => handleWeightChange('economic', v)}
          description="Can they justify the economic investment?"
        />
      </div>

      {/* Configuration Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Configuration
        </h3>

        {/* Situation Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Situation Keywords (industry context)
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newSitKeyword}
              onChange={(e) => setNewSitKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSituationKeyword()}
              placeholder="Add keyword (e.g., 'transformation')"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              onClick={addSituationKeyword}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.config.situationKeywords.map((keyword) => (
              <div
                key={keyword}
                className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200 px-3 py-1 rounded-full text-sm"
              >
                {keyword}
                <button
                  onClick={() => removeSituationKeyword(keyword)}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Problem Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Problem Keywords (pain points)
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newProbKeyword}
              onChange={(e) => setNewProbKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addProblemKeyword()}
              placeholder="Add keyword (e.g., 'challenge')"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              onClick={addProblemKeyword}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-medium"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {config.config.problemKeywords.map((keyword) => (
              <div
                key={keyword}
                className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 px-3 py-1 rounded-full text-sm"
              >
                {keyword}
                <button
                  onClick={() => removeProblemKeyword(keyword)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Economic Value */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Minimum Economic Value
          </label>
          <input
            type="number"
            value={config.config.economicMinValue}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                config: {
                  ...prev.config,
                  economicMinValue: Number(e.target.value),
                },
              }))
            }
            placeholder="Min value"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Minimum deal value to qualify as economic buyer
          </p>
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

export default SPICEConfig;
