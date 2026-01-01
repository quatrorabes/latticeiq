/**
 * ScoringSettingsPage.tsx
 * Configure scoring weights for MDCP, BANT, and SPICE frameworks
 */

import { useState, useEffect } from 'react'
import { getAuthToken } from '../api/contacts'
import { Save, RotateCcw, Info } from 'lucide-react'

interface WeightConfig {
  [key: string]: number
}

interface ScoringWeights {
  mdcp: WeightConfig
  bant: WeightConfig
  spice: WeightConfig
  persona_scores: { [key: string]: number }
  vertical_scores: { [key: string]: number }
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  mdcp: {
    market_fit: 25,
    decision_maker: 30,
    company_profile: 25,
    pain_indicators: 20,
  },
  bant: {
    budget: 25,
    authority: 30,
    need: 25,
    timeline: 20,
  },
  spice: {
    situation: 20,
    pain: 25,
    impact: 20,
    critical_event: 20,
    evaluation: 15,
  },
  persona_scores: {
    'decision-maker': 1.0,
    'champion': 0.85,
    'influencer': 0.7,
    'initiator': 0.6,
    'unknown': 0.5,
  },
  vertical_scores: {
    'finance': 1.0,
    'insurance': 0.95,
    'equipment leasing': 0.9,
    'saas': 0.85,
    'healthcare': 0.8,
    'other': 0.6,
    'unknown': 0.5,
  },
}

export default function ScoringSettingsPage() {
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadWeights()
  }, [])

  const loadWeights = async () => {
    try {
      const token = await getAuthToken()
      const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'
      
      const res = await fetch(`${API_BASE}/api/v3/settings/scoring-weights`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (res.ok) {
        const data = await res.json()
        setWeights(data)
      }
    } catch (err) {
      console.error('Failed to load weights:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveWeights = async () => {
    setSaving(true)
    try {
      const token = await getAuthToken()
      const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'
      
      const res = await fetch(`${API_BASE}/api/v3/settings/scoring-weights`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(weights),
      })
      
      if (res.ok) {
        showToast('✓ Scoring weights saved!')
      } else {
        showToast('Failed to save weights')
      }
    } catch (err) {
      showToast('Error saving weights')
    } finally {
      setSaving(false)
    }
  }

  const resetWeights = async () => {
    if (!confirm('Reset all scoring weights to defaults?')) return
    
    try {
      const token = await getAuthToken()
      const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'
      
      const res = await fetch(`${API_BASE}/api/v3/settings/scoring-weights/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      
      if (res.ok) {
        const data = await res.json()
        setWeights(data.weights)
        showToast('✓ Weights reset to defaults')
      }
    } catch (err) {
      showToast('Error resetting weights')
    }
  }

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const updateWeight = (framework: 'mdcp' | 'bant' | 'spice', key: string, value: number) => {
    setWeights(prev => ({
      ...prev,
      [framework]: {
        ...prev[framework],
        [key]: value,
      },
    }))
  }

  const updateMultiplier = (type: 'persona_scores' | 'vertical_scores', key: string, value: number) => {
    setWeights(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: value,
      },
    }))
  }

  const getTotal = (framework: WeightConfig) => {
    return Object.values(framework).reduce((sum, val) => sum + val, 0)
  }

  const formatLabel = (key: string) => {
    return key.replace(/_/g, ' ').replace(/-/g, ' ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading scoring settings...</div>
      </div>
    )
  }

  const WeightCard = ({ 
    title, 
    badge, 
    badgeColor, 
    framework, 
    frameworkKey 
  }: { 
    title: string
    badge: string
    badgeColor: string
    framework: WeightConfig
    frameworkKey: 'mdcp' | 'bant' | 'spice'
  }) => {
    const total = getTotal(framework)
    const isValid = total === 100
    
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-bold ${badgeColor}`}>
              {badge}
            </span>
            <h3 className="text-white font-semibold">{title}</h3>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            isValid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {total}%
          </span>
        </div>
        
        <div className="space-y-4">
          {Object.entries(framework).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400 text-sm capitalize">{formatLabel(key)}</span>
                <span className="text-white font-semibold text-sm">{value}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={value}
                onChange={e => updateWeight(frameworkKey, key, parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🎯 Scoring Settings</h1>
        <p className="text-slate-400">Configure how contacts are scored with MDCP, BANT, and SPICE frameworks</p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-8 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-blue-400 font-semibold mb-1">How Scoring Works</div>
          <p className="text-slate-400 text-sm">
            Each framework (MDCP, BANT, SPICE) calculates a score from 0-100. Weights determine how much each factor 
            contributes to the total. <strong className="text-white">Weights should add up to 100</strong> for each framework. 
            Persona and vertical multipliers affect how much weight is given based on the contact's role and industry.
          </p>
        </div>
      </div>

      {/* Framework Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <WeightCard
          title="Market Fit"
          badge="MDCP"
          badgeColor="bg-red-500/20 text-red-400"
          framework={weights.mdcp}
          frameworkKey="mdcp"
        />
        <WeightCard
          title="Sales Ready"
          badge="BANT"
          badgeColor="bg-blue-500/20 text-blue-400"
          framework={weights.bant}
          frameworkKey="bant"
        />
        <WeightCard
          title="Pain Points"
          badge="SPICE"
          badgeColor="bg-green-500/20 text-green-400"
          framework={weights.spice}
          frameworkKey="spice"
        />
      </div>

      {/* Multipliers */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-8">
        <h3 className="text-white font-semibold text-lg mb-2">⚡ Score Multipliers</h3>
        <p className="text-slate-400 text-sm mb-6">
          These multipliers adjust scores based on persona type and industry vertical (0.0 - 1.0)
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Persona Multipliers */}
          <div>
            <div className="text-white font-medium mb-4 flex items-center gap-2">
              <span>👤</span> Persona Multipliers
            </div>
            <div className="space-y-2">
              {Object.entries(weights.persona_scores).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center py-2 border-b border-slate-700">
                  <span className="text-slate-400 text-sm capitalize">{formatLabel(key)}</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value}
                    onChange={e => updateMultiplier('persona_scores', key, parseFloat(e.target.value) || 0)}
                    className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Vertical Multipliers */}
          <div>
            <div className="text-white font-medium mb-4 flex items-center gap-2">
              <span>🏭</span> Vertical Multipliers
            </div>
            <div className="space-y-2">
              {Object.entries(weights.vertical_scores).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center py-2 border-b border-slate-700">
                  <span className="text-slate-400 text-sm capitalize">{formatLabel(key)}</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value}
                    onChange={e => updateMultiplier('vertical_scores', key, parseFloat(e.target.value) || 0)}
                    className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-6 border-t border-slate-700">
        <button
          onClick={resetWeights}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
        <button
          onClick={loadWeights}
          className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={saveWeights}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  )
}
