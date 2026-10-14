import React from 'react'
import { EnrichmentMode, SavedEnrichments, snapshotTimestamp } from '../lib/savedEnrichment'

interface Props {
  selected: EnrichmentMode
  results: SavedEnrichments
  onSelect: (mode: EnrichmentMode) => void
}

export default function SavedEnrichmentTabs({ selected, results, onSelect }: Props) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div role="tablist" aria-label="Saved enrichment results"
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {(['quick', 'deep'] as const).map(mode => {
          const timestamp = snapshotTimestamp(results[mode])
          return (
            <button key={mode} type="button" role="tab"
              id={`saved-${mode}-tab`} aria-selected={selected === mode}
              aria-controls={`saved-${mode}-panel`} tabIndex={selected === mode ? 0 : -1}
              onClick={() => onSelect(mode)}
              onKeyDown={event => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault()
                  const next = event.key === 'Home' ? 'quick' : event.key === 'End'
                    ? 'deep' : mode === 'quick' ? 'deep' : 'quick'
                  onSelect(next)
                  document.getElementById(`saved-${next}-tab`)?.focus()
                }
              }}
              style={{
                flex: '1 1 140px', padding: '0.75rem 1rem', textAlign: 'left',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                border: selected === mode ? '1px solid #818cf8' : '1px solid #334155',
                background: selected === mode ? '#252a46' : '#1e293b',
                color: selected === mode ? '#e0e7ff' : '#cbd5e1',
              }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600 }}>
                {mode === 'quick' ? 'Quick' : 'Deep'}
                <span style={{ marginLeft: 8, fontWeight: 400 }}>
                  {results[mode] ? 'Saved' : 'Not saved'}
                </span>
              </span>
              <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: '#94a3b8' }}>
                {timestamp && !Number.isNaN(Date.parse(timestamp))
                  ? new Date(timestamp).toLocaleString()
                  : results[mode] ? 'Saved date unavailable' : 'No independent result retained'}
              </span>
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
        Switching tabs uses saved data. Only enrichment or refresh actions use API credits.
      </p>
    </div>
  )
}
