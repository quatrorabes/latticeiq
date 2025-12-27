import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ICPConfig {
  industry: string;
  companySize: string;
  painPoints: string[];
  useCase: string;
  budget: string;
}

interface ScoringConfig {
  mdcp: {
    moneyWeight: number;
    decisionMakerWeight: number;
    championWeight: number;
    processWeight: number;
    hotThreshold: number;
    warmThreshold: number;
  };
  bant: {
    budgetWeight: number;
    authorityWeight: number;
    needWeight: number;
    timelineWeight: number;
    hotThreshold: number;
    warmThreshold: number;
  };
  spice: {
    situationWeight: number;
    problemWeight: number;
    implicationWeight: number;
    consequenceWeight: number;
    economicWeight: number;
    hotThreshold: number;
    warmThreshold: number;
  };
}

export default function SetupPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [icp, setIcp] = useState<ICPConfig>({
    industry: '',
    companySize: 'mid-market',
    painPoints: [],
    useCase: '',
    budget: '',
  });

  const [scoring, setScoring] = useState<ScoringConfig>({
    mdcp: {
      moneyWeight: 25,
      decisionMakerWeight: 25,
      championWeight: 25,
      processWeight: 25,
      hotThreshold: 75,
      warmThreshold: 50,
    },
    bant: {
      budgetWeight: 25,
      authorityWeight: 25,
      needWeight: 25,
      timelineWeight: 25,
      hotThreshold: 75,
      warmThreshold: 50,
    },
    spice: {
      situationWeight: 20,
      problemWeight: 20,
      implicationWeight: 20,
      consequenceWeight: 20,
      economicWeight: 20,
      hotThreshold: 80,
      warmThreshold: 60,
    },
  });

  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [newPainPoint, setNewPainPoint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function saveConfiguration() {
    setIsSaving(true);
    setError(null);
    try {
      const result = await supabase.auth.getSession();
      const sess = result.data.session;
      if (!sess) {
        setError('Not logged in');
        setIsSaving(false);
        return;
      }

      // Save ICP Config
      const icpResponse = await fetch(import.meta.env.VITE_API_URL + '/api/v3/scoring/icp-config', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + sess.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...icp, painPoints }),
      });

      if (!icpResponse.ok) throw new Error('Failed to save ICP config');

      // Save MDCP Config
      const mdcpResponse = await fetch(import.meta.env.VITE_API_URL + '/api/v3/scoring/mdcp-config', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + sess.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scoring.mdcp),
      });

      if (!mdcpResponse.ok) throw new Error('Failed to save MDCP config');

      // Save BANT Config
      const bantResponse = await fetch(import.meta.env.VITE_API_URL + '/api/v3/scoring/bant-config', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + sess.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scoring.bant),
      });

      if (!bantResponse.ok) throw new Error('Failed to save BANT config');

      // Save SPICE Config
      const spiceResponse = await fetch(import.meta.env.VITE_API_URL + '/api/v3/scoring/spice-config', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + sess.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scoring.spice),
      });

      if (!spiceResponse.ok) throw new Error('Failed to save SPICE config');

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving configuration');
    } finally {
      setIsSaving(false);
    }
  }

  function addPainPoint() {
    if (newPainPoint.trim() && !painPoints.includes(newPainPoint.trim())) {
      setPainPoints([...painPoints, newPainPoint.trim()]);
      setNewPainPoint('');
    }
  }

  function removePainPoint(point: string) {
    setPainPoints(painPoints.filter(p => p !== point));
  }

  const tabs = [
    { label: 'ICP Definition', icon: '👥' },
    { label: 'Scoring Models', icon: '📊' },
    { label: 'Pain Points', icon: '⚡' },
    { label: 'Placeholders', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Setup Your Scoring Profile</h1>
          <p className="text-slate-400">Configure your ICP, adjust scoring weights, and define deal triggers</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-700">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-6 py-3 font-medium transition ${
                activeTab === idx
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 mb-8">
          {/* Tab 1: ICP Definition */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-white font-semibold mb-3">Industry</label>
                <input
                  type="text"
                  value={icp.industry}
                  onChange={(e) => setIcp({ ...icp, industry: e.target.value })}
                  placeholder="e.g., SaaS, Finance, Healthcare"
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-3">Company Size</label>
                <select
                  value={icp.companySize}
                  onChange={(e) => setIcp({ ...icp, companySize: e.target.value })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-400 focus:outline-none"
                >
                  <option value="startup">Startup (1-50)</option>
                  <option value="small">Small (50-200)</option>
                  <option value="mid-market">Mid-Market (200-1000)</option>
                  <option value="enterprise">Enterprise (1000+)</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-semibold mb-3">Primary Use Case</label>
                <input
                  type="text"
                  value={icp.useCase}
                  onChange={(e) => setIcp({ ...icp, useCase: e.target.value })}
                  placeholder="e.g., Lead generation, Sales automation, Data analytics"
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-3">Typical Budget Range</label>
                <input
                  type="text"
                  value={icp.budget}
                  onChange={(e) => setIcp({ ...icp, budget: e.target.value })}
                  placeholder="e.g., $50K-$500K annual"
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Scoring Models */}
          {activeTab === 1 && (
            <div className="space-y-8">
              {/* MDCP */}
              <div className="border-b border-slate-700 pb-8">
                <h3 className="text-xl font-bold text-white mb-4">MDCP Framework</h3>
                <p className="text-slate-400 text-sm mb-6">Money, Decision-maker, Champion, Process</p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Money Weight ({scoring.mdcp.moneyWeight}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.mdcp.moneyWeight}
                      onChange={(e) => setScoring({
                        ...scoring,
                        mdcp: { ...scoring.mdcp, moneyWeight: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Decision-Maker Weight ({scoring.mdcp.decisionMakerWeight}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.mdcp.decisionMakerWeight}
                      onChange={(e) => setScoring({
                        ...scoring,
                        mdcp: { ...scoring.mdcp, decisionMakerWeight: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Hot Threshold ({scoring.mdcp.hotThreshold})</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.mdcp.hotThreshold}
                      onChange={(e) => setScoring({
                        ...scoring,
                        mdcp: { ...scoring.mdcp, hotThreshold: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Warm Threshold ({scoring.mdcp.warmThreshold})</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.mdcp.warmThreshold}
                      onChange={(e) => setScoring({
                        ...scoring,
                        mdcp: { ...scoring.mdcp, warmThreshold: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* BANT */}
              <div className="border-b border-slate-700 pb-8">
                <h3 className="text-xl font-bold text-white mb-4">BANT Framework</h3>
                <p className="text-slate-400 text-sm mb-6">Budget, Authority, Need, Timeline</p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Budget Weight ({scoring.bant.budgetWeight}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.bant.budgetWeight}
                      onChange={(e) => setScoring({
                        ...scoring,
                        bant: { ...scoring.bant, budgetWeight: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Authority Weight ({scoring.bant.authorityWeight}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.bant.authorityWeight}
                      onChange={(e) => setScoring({
                        ...scoring,
                        bant: { ...scoring.bant, authorityWeight: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Hot Threshold ({scoring.bant.hotThreshold})</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.bant.hotThreshold}
                      onChange={(e) => setScoring({
                        ...scoring,
                        bant: { ...scoring.bant, hotThreshold: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Warm Threshold ({scoring.bant.warmThreshold})</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.bant.warmThreshold}
                      onChange={(e) => setScoring({
                        ...scoring,
                        bant: { ...scoring.bant, warmThreshold: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* SPICE */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4">SPICE Framework</h3>
                <p className="text-slate-400 text-sm mb-6">Situation, Problem, Implication, Consequence, Economic</p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Situation Weight ({scoring.spice.situationWeight}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.spice.situationWeight}
                      onChange={(e) => setScoring({
                        ...scoring,
                        spice: { ...scoring.spice, situationWeight: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Hot Threshold ({scoring.spice.hotThreshold})</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.spice.hotThreshold}
                      onChange={(e) => setScoring({
                        ...scoring,
                        spice: { ...scoring.spice, hotThreshold: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm mb-2 block">Warm Threshold ({scoring.spice.warmThreshold})</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoring.spice.warmThreshold}
                      onChange={(e) => setScoring({
                        ...scoring,
                        spice: { ...scoring.spice, warmThreshold: parseInt(e.target.value) }
                      })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Pain Points */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <p className="text-slate-400">Define the top pain points your ICP experiences. These will inform enrichment and scoring.</p>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPainPoint}
                  onChange={(e) => setNewPainPoint(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPainPoint()}
                  placeholder="e.g., Manual lead qualification takes 40% of time"
                  className="flex-1 bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:border-blue-400 focus:outline-none"
                />
                <button
                  onClick={addPainPoint}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium transition"
                >
                  Add
                </button>
              </div>

              {painPoints.length > 0 && (
                <div className="space-y-2">
                  {painPoints.map((point, idx) => (
                    <div key={idx} className="bg-slate-700 p-3 rounded flex justify-between items-center">
                      <span className="text-white">{point}</span>
                      <button
                        onClick={() => removePainPoint(point)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Placeholders */}
          {activeTab === 3 && (
            <div className="space-y-4">
              <div className="bg-slate-700 p-4 rounded border border-slate-600">
                <h4 className="text-white font-semibold mb-2">🔄 Deal Routing Rules</h4>
                <p className="text-slate-400 text-sm">Coming soon - Route Hot leads to sales team automatically</p>
              </div>

              <div className="bg-slate-700 p-4 rounded border border-slate-600">
                <h4 className="text-white font-semibold mb-2">📧 Email Integration</h4>
                <p className="text-slate-400 text-sm">Coming soon - Send scored leads to Slack or email</p>
              </div>

              <div className="bg-slate-700 p-4 rounded border border-slate-600">
                <h4 className="text-white font-semibold mb-2">🔗 CRM Sync</h4>
                <p className="text-slate-400 text-sm">Coming soon - Sync scores back to HubSpot, Salesforce, Pipedrive</p>
              </div>

              <div className="bg-slate-700 p-4 rounded border border-slate-600">
                <h4 className="text-white font-semibold mb-2">📊 Analytics & Reporting</h4>
                <p className="text-slate-400 text-sm">Coming soon - Win/loss tracking, framework effectiveness metrics</p>
              </div>

              <div className="bg-slate-700 p-4 rounded border border-slate-600">
                <h4 className="text-white font-semibold mb-2">🤖 AI Enrichment</h4>
                <p className="text-slate-400 text-sm">Coming soon - Auto-enrich with Perplexity and GPT-4o synthesis</p>
              </div>

              <div className="bg-slate-700 p-4 rounded border border-slate-600">
                <h4 className="text-white font-semibold mb-2">👥 Team Collaboration</h4>
                <p className="text-slate-400 text-sm">Coming soon - Share insights, notes, and deal status with team</p>
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-900 text-red-100 p-4 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-900 text-green-100 p-4 rounded">
            ✓ Configuration saved successfully!
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab(Math.max(0, activeTab - 1))}
            disabled={activeTab === 0}
            className={`px-6 py-3 rounded font-medium transition ${
              activeTab === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            ← Previous
          </button>

          <button
            onClick={() => setActiveTab(Math.min(tabs.length - 1, activeTab + 1))}
            disabled={activeTab === tabs.length - 1}
            className={`px-6 py-3 rounded font-medium transition ${
              activeTab === tabs.length - 1
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            Next →
          </button>

          <button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded font-medium transition disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : '💾 Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
