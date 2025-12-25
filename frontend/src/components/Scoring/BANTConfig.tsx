import React, { useState, useEffect } from 'react';
import { getScoringConfig, saveScoringConfig } from '../../api/scoring';

type BANTConfigState = {
  budget_weight: number;
  budget_min: number;
  budget_max: number;
  authority_weight: number;
  authority_titles: string[];
  need_weight: number;
  need_keywords: string[];
  timeline_weight: number;
  timeline_urgency_keywords: string[];
  hot_threshold: number;
  warm_threshold: number;
};

const DEFAULT_BANT_CONFIG: BANTConfigState = {
  budget_weight: 25,
  budget_min: 50000,
  budget_max: 5000000,
  authority_weight: 25,
  authority_titles: ['CEO', 'VP', 'Director'],
  need_weight: 25,
  need_keywords: ['growth', 'scale', 'automate', 'efficiency'],
  timeline_weight: 25,
  timeline_urgency_keywords: ['this quarter', 'this month', 'urgent'],
  hot_threshold: 71,
  warm_threshold: 40,
};

export const BANTConfig: React.FC = () => {
  const [config, setConfig] = useState<BANTConfigState>(DEFAULT_BANT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setLoading(true);
      try {
        const data = await getScoringConfig('BANT');
        if (!isMounted) return;
        setConfig({
          budget_weight: data.budget_weight ?? DEFAULT_BANT_CONFIG.budget_weight,
          budget_min: data.budget_min ?? DEFAULT_BANT_CONFIG.budget_min,
          budget_max: data.budget_max ?? DEFAULT_BANT_CONFIG.budget_max,
          authority_weight:
            data.authority_weight ?? DEFAULT_BANT_CONFIG.authority_weight,
          authority_titles:
            data.authority_titles ?? DEFAULT_BANT_CONFIG.authority_titles,
          need_weight: data.need_weight ?? DEFAULT_BANT_CONFIG.need_weight,
          need_keywords:
            data.need_keywords ?? DEFAULT_BANT_CONFIG.need_keywords,
          timeline_weight:
            data.timeline_weight ?? DEFAULT_BANT_CONFIG.timeline_weight,
          timeline_urgency_keywords:
            data.timeline_urgency_keywords ??
            DEFAULT_BANT_CONFIG.timeline_urgency_keywords,
          hot_threshold:
            data.hot_threshold ?? DEFAULT_BANT_CONFIG.hot_threshold,
          warm_threshold:
            data.warm_threshold ?? DEFAULT_BANT_CONFIG.warm_threshold,
        });
      } catch (e) {
        console.error('Failed to load BANT config:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleWeightChange = (key: keyof BANTConfigState, value: number) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveScoringConfig('BANT', config);
      alert('BANT configuration saved');
    } catch (e) {
      console.error('Failed to save BANT config:', e);
      alert('Failed to save BANT configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-300">
        Configure the BANT framework: Budget, Authority, Need, Timeline for
        enterprise deal qualification.
      </p>

      {/* Budget */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Budget</h3>
        <p className="text-xs text-gray-400">
          Points for company having sufficient budget to purchase your solution.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.budget_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.budget_weight}
            onChange={e =>
              handleWeightChange('budget_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1">
              Min Budget
            </label>
            <input
              type="number"
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
              value={config.budget_min}
              onChange={e =>
                setConfig(prev => ({
                  ...prev,
                  budget_min: Number(e.target.value),
                }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">
              Max Budget
            </label>
            <input
              type="number"
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
              value={config.budget_max}
              onChange={e =>
                setConfig(prev => ({
                  ...prev,
                  budget_max: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </section>

      {/* Authority */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Authority</h3>
        <p className="text-xs text-gray-400">
          Points for contact having decision-making authority.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.authority_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.authority_weight}
            onChange={e =>
              handleWeightChange('authority_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Authority Titles (comma-separated)
          </label>
          <input
            type="text"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.authority_titles.join(', ')}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                authority_titles: e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </section>

      {/* Need */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Need</h3>
        <p className="text-xs text-gray-400">
          Points for having identified need/pain point you solve.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.need_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.need_weight}
            onChange={e =>
              handleWeightChange('need_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Need Keywords (comma-separated)
          </label>
          <input
            type="text"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.need_keywords.join(', ')}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                need_keywords: e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </section>

      {/* Timeline */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Timeline</h3>
        <p className="text-xs text-gray-400">
          Points for urgency signals indicating near-term buying timeline.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.timeline_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.timeline_weight}
            onChange={e =>
              handleWeightChange('timeline_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Timeline Urgency Keywords (comma-separated)
          </label>
          <input
            type="text"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.timeline_urgency_keywords.join(', ')}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                timeline_urgency_keywords: e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </section>

      {/* Thresholds */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">
          Thresholds & Tiers
        </h3>
        <p className="text-xs text-gray-400">
          Score of {config.hot_threshold}+ = Hot lead (strong fit, ready to
          engage). Score of {config.warm_threshold}–
          {config.hot_threshold - 1} = Warm lead (potential fit, needs more
          info).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1">
              Hot Threshold (min score)
            </label>
            <input
              type="number"
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
              value={config.hot_threshold}
              onChange={e =>
                setConfig(prev => ({
                  ...prev,
                  hot_threshold: Number(e.target.value),
                }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">
              Warm Threshold (min score)
            </label>
            <input
              type="number"
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
              value={config.warm_threshold}
              onChange={e =>
                setConfig(prev => ({
                  ...prev,
                  warm_threshold: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </section>

      {/* JSON debug + Save */}
      <section className="space-y-3">
        <div className="text-xs text-gray-400">
          <div>Tier Distribution and configuration JSON:</div>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/40 p-2 text-[11px] text-gray-300">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center rounded bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save BANT Configuration'}
        </button>
      </section>
    </div>
  );
};
