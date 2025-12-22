import React, { useState, useEffect } from 'react';
import { getScoringConfig, saveScoringConfig } from '../../api/scoring';

type SPICEConfigState = {
  situation_weight: number;
  problem_weight: number;
  implication_weight: number;
  consequence_weight: number;
  economic_weight: number;
  problem_keywords: string[];
  implication_keywords: string[];
  consequence_keywords: string[];
  hot_threshold: number;
  warm_threshold: number;
};

const DEFAULT_SPICE_CONFIG: SPICEConfigState = {
  situation_weight: 20,
  problem_weight: 20,
  implication_weight: 20,
  consequence_weight: 20,
  economic_weight: 20,
  problem_keywords: ['challenge', 'issue', 'problem', 'difficulty', 'pain'],
  implication_keywords: ['impact', 'affect', 'consequence', 'result'],
  consequence_keywords: ['risk', 'critical', 'urgent', 'important'],
  hot_threshold: 71,
  warm_threshold: 40,
};

export const SPICEConfig: React.FC = () => {
  const [config, setConfig] = useState<SPICEConfigState>(DEFAULT_SPICE_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setLoading(true);
      try {
        const data = await getScoringConfig('SPICE');
        if (!isMounted) return;
        setConfig({
          situation_weight:
            data.situation_weight ?? DEFAULT_SPICE_CONFIG.situation_weight,
          problem_weight:
            data.problem_weight ?? DEFAULT_SPICE_CONFIG.problem_weight,
          implication_weight:
            data.implication_weight ??
            DEFAULT_SPICE_CONFIG.implication_weight,
          consequence_weight:
            data.consequence_weight ??
            DEFAULT_SPICE_CONFIG.consequence_weight,
          economic_weight:
            data.economic_weight ?? DEFAULT_SPICE_CONFIG.economic_weight,
          problem_keywords:
            data.problem_keywords ?? DEFAULT_SPICE_CONFIG.problem_keywords,
          implication_keywords:
            data.implication_keywords ??
            DEFAULT_SPICE_CONFIG.implication_keywords,
          consequence_keywords:
            data.consequence_keywords ??
            DEFAULT_SPICE_CONFIG.consequence_keywords,
          hot_threshold:
            data.hot_threshold ?? DEFAULT_SPICE_CONFIG.hot_threshold,
          warm_threshold:
            data.warm_threshold ?? DEFAULT_SPICE_CONFIG.warm_threshold,
        });
      } catch (e) {
        console.error('Failed to load SPICE config:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleWeightChange = (key: keyof SPICEConfigState, value: number) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveScoringConfig('SPICE', config);
      alert('SPICE configuration saved');
    } catch (e) {
      console.error('Failed to save SPICE config:', e);
      alert('Failed to save SPICE configuration');
    } finally {
      setSaving(false);
    }
  };

  const description =
    'Configure the SPICE framework: Situation, Problem, Implication, Consequence, Economic for complex solutions. Note: SPICE works best with Phase 2 deep enrichment; with quick enrich, expect ~50% accuracy.';

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-300">{description}</p>

      {/* Situation */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Situation</h3>
        <p className="text-xs text-gray-400">
          Points for understanding the company&apos;s current situation and
          context.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.situation_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.situation_weight}
            onChange={e =>
              handleWeightChange('situation_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
      </section>

      {/* Problem */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Problem</h3>
        <p className="text-xs text-gray-400">
          Points for identifying specific problems or challenges they face.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.problem_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.problem_weight}
            onChange={e =>
              handleWeightChange('problem_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Problem Keywords (comma-separated)
          </label>
          <input
            type="text"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.problem_keywords.join(', ')}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                problem_keywords: e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </section>

      {/* Implication */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Implication</h3>
        <p className="text-xs text-gray-400">
          Points for understanding implications of problems (business impact).
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.implication_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.implication_weight}
            onChange={e =>
              handleWeightChange('implication_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Implication Keywords (comma-separated)
          </label>
          <input
            type="text"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.implication_keywords.join(', ')}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                implication_keywords: e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </section>

      {/* Consequence */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Consequence</h3>
        <p className="text-xs text-gray-400">
          Points for understanding risk and consequences of inaction.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.consequence_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.consequence_weight}
            onChange={e =>
              handleWeightChange('consequence_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            Consequence Keywords (comma-separated)
          </label>
          <input
            type="text"
            className="w-full rounded bg-gray-900 border border-gray-700 px-2 py-1 text-sm text-gray-100"
            value={config.consequence_keywords.join(', ')}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                consequence_keywords: e.target.value
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </section>

      {/* Economic */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">Economic</h3>
        <p className="text-xs text-gray-400">
          Points for quantifying financial impact or budget allocation.
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-300">
            Weight: {config.economic_weight}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={config.economic_weight}
            onChange={e =>
              handleWeightChange('economic_weight', Number(e.target.value))
            }
            className="w-full"
          />
        </div>
      </section>

      {/* Thresholds */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-100">
          Thresholds & Tiers
        </h3>
        <p className="text-xs text-gray-400">
          Score of {config.hot_threshold}+ = Hot lead (excellent fit, high
          buying intent). Score of {config.warm_threshold}–
          {config.hot_threshold - 1} = Warm lead (potential fit, needs
          research).
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
          {saving ? 'Saving…' : 'Save SPICE Configuration'}
        </button>
      </section>
    </div>
  );
};
