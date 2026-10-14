import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/savedEnrichment.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const { normalizeSavedEnrichments, snapshotTimestamp } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
)

test('empty values never synthesize results', () => {
  for (const value of [null, undefined, {}, '', 42]) {
    assert.deepEqual(normalizeSavedEnrichments(value), { quick: null, deep: null })
  }
})
test('legacy Quick remains Quick', () => {
  const payload = { mode: 'quick', data: { meta: { source: 'quick' } }, legacy: { summary: 'Original' } }
  assert.deepEqual(normalizeSavedEnrichments(payload), { quick: payload, deep: null })
})
test('legacy Deep remains Deep with empty Quick', () => {
  const payload = { data: { meta: { source: 'deep' }, contact_profile: {} } }
  assert.deepEqual(normalizeSavedEnrichments(payload), { quick: null, deep: payload })
})
test('unknown legacy result is not mislabelled', () => {
  assert.deepEqual(normalizeSavedEnrichments({ data: { contact_profile: {} } }), {
    quick: null, deep: null,
  })
})
test('both snapshots remain independent regardless of latest mode', () => {
  const quick = { data: { contact_profile: { headline: 'Quick' } } }
  const deep = { data: { contact_profile: { headline: 'Deep' } } }
  for (const mode of ['quick', 'deep']) {
    assert.deepEqual(normalizeSavedEnrichments({
      mode, data: { contact_profile: { headline: 'Latest' } },
      saved_results: { quick, deep },
    }), { quick, deep })
  }
})
test('timestamps use per-snapshot metadata and legacy dates', () => {
  assert.equal(snapshotTimestamp({ data: { meta: { generated_at: 'quick-date' } } }), 'quick-date')
  assert.equal(snapshotTimestamp({ enriched_at: 'deep-date', data: { meta: {} } }), 'deep-date')
  assert.equal(snapshotTimestamp({ legacy: { generatedat: 'legacy-date' } }), 'legacy-date')
  assert.equal(snapshotTimestamp(null), null)
  assert.equal(snapshotTimestamp({ data: { meta: { generated_at: '2026-10-14T19:00:00' } } }),
    '2026-10-14T19:00:00Z')
})
