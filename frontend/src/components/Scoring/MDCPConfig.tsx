import React, { useState, useEffect } from 'react';
import { getScoringConfig, saveScoringConfig } from '../../api/scoring';

type MDCPConfigState = {
  money_weight: number;
  money_min_revenue: number;
  money_max_revenue: number;
  decision_maker_weight: number;
  decision_maker_titles: string[];
  champion_weight: number;
  champion_engagement_days: number;
  process_weight: number;
  process_days: number;
  hot_threshold: number;
  warm_threshold: number;
};

const DEFAULT_MDCP_CONFIG: MDCPConfigState = {
  money_weight: 25,
  money_min_revenue: 1000000,
  money_max_revenue: 100000000,
  decision_maker_weight: 25,
  decision_maker_titles: ['CEO', 'CTO', 'VP Sales'],
  champion_weight: 25,
  champion_engagement_days: 30,
  process_weight: 25,
  process_days: 90,
  hot_threshold: 71,
  warm_threshold: 40,
};

export const MDCPConfig: React.FC = () => {
  const [config, setConfig] = useState<MDCPConfigState>(DEFAULT_MDCP_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load config from backend on mount
  useEffect(() => {
    let isMounted = true;

    (async () => {
      setLoading(true);
      try {
        const data = await getScoringConfig('mdcp');
        if (!isMounted) return;

        // Defensive mapping: fall back to defaults if fields missing
        setConfig({
          money_weight: data.money_weight ?? DEFAULT_MDCP_CONFIG.money_weight,
          money_min_revenue:
            data.money_min_revenue ?? DEFAULT_MDCP_CONFIG.money_min_revenue,
          money_max_revenue:
            data.money_max_revenue ?? DEFAULT_MDCP_CONFIG.money_max_revenue,
          decision_maker_weight:
            data.decision_maker_weight ??
            DEFAULT_MDCP_CONFIG.decision_maker_weight,
          decision_maker_titles:
            data.decision_maker_titles ??
            DEFAULT_MDCP_CONFIG.decision_maker_titles,
          champion_weight:
            data.champion_weight ?? DEFAULT_MDCP_CONFIG.champion_weight,
          champion_engagement_days:
            data.champion_engagement_days ??
            DEFAULT_MDCP_CONFIG.champion_engagement_days,
          process_weight:
            data.process_weight ?? DEFAULT_MDCP_CONFIG.process_weight,
          process_days: data.process_days ?? DEFAULT_MDCP_CONFIG.process_days,
          hot_threshold:
            data.hot_threshold ?? DEFAULT_MDCP_CONFIG.hot_threshold,
          warm_threshold:
            data.warm_threshold ?? DEFAULT_MDCP_CONFIG.warm_threshold,
        });
      } catch (e) {
        console.error('Failed to load MDCP config:', e);
        // keep defaults
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleWeightChange = (key: keyof MDCPConfigState, value: number) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveScoringConfig('mdcp', config);
      alert('MDCP configuration saved');
    } catch (e) {
      console.error('Failed to save MDCP config:', e);
      alert('Failed to save MDCP configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-300">
        Configure the MDCP framework: Money, Decision-maker, Champion, Process
        for sales qualification.
      </p>

      {/* Money / Revenue Section */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Money (Budget)</h3>
        <p className="text-xs text-gray-400">
          Points for company having sufficient budget to purchase your solution.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.money_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.money_weight}
            onChange={e =>
              handleWeightChange('money_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1">
              Min Revenue
            </label>
            <input
              type="number"
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
              value={config.money_min_revenue}
              onChange={e =>
                setConfig(prev => ({
                  ...prev,
                  money_min_revenue: Number(e.target.value),
                }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">
              Max Revenue
            </label>
            <input
              type="number"
              className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
              value={config.money_max_revenue}
              onChange={e =>
                setConfig(prev => ({
                  ...prev,
                  money_max_revenue: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </section>

      {/* Decision-maker Section */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">
          Decision-maker
        </h3>
        <p className="text-xs text-gray-400">
          Points for contact having authority to make purchase decisions.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.decision_maker_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.decision_maker_weight}
            onChange={e =>
              handleWeightChange(
                'decision_maker_weight',
                Number(e.target.value),
              )
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Decision-maker Titles (comma-separated)
          </label>
          <input
            type="text"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.decision_maker_titles.join(', ')}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                decision_maker_titles: e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </section>

      {/* Champion Section */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Champion</h3>
        <p className="text-xs text-gray-400">
          Points for contact who will advocate internally (engagement signal).
          Contact enriched within {config.champion_engagement_days} days = champion.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.champion_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.champion_weight}
            onChange={e =>
              handleWeightChange('champion_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Engagement Days Threshold
          </label>
          <input
            type="number"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.champion_engagement_days}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                champion_engagement_days: Number(e.target.value),
              }))
            }
          />
        </div>
      </section>

      {/* Process Section */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Process</h3>
        <p className="text-xs text-gray-400">
          Points for being in active deal cycle (implementation window). Contact
          in active process within {config.process_days} days.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.process_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.process_weight}
            onChange={e =>
              handleWeightChange('process_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Process Days Window
          </label>
          <input
            type="number"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.process_days}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                process_days: Number(e.target.value),
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
          {saving ? 'Saving…' : 'Save MDCP Configuration'}
        </button>
      </section>
    </div>
  );
};
