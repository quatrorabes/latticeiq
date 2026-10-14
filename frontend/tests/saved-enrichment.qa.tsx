/** Browser fixture mounts the REAL modal. Network must be intercepted in QA.
 * This is not production app code and uses no real contact or credentials.
 */
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import ContactDetailModal from '../src/components/ContactDetailModal'
import { Contact } from '../src/types'

const mode = new URLSearchParams(location.search).get('mode') || 'both'
function data(source: string) {
  return {
    contact_id: 'qa-contact',
    contact_profile: { headline: `${source} saved headline`, role_summary: `${source} independent summary`, background_bullets: [] },
    company_profile: { one_liner: 'Synthetic company', key_products_or_services: [] },
    current_focus: { strategic_initiatives: [], recent_projects: [], primary_kpis: [] },
    buying_signals: { recent_news: [], hiring_signals: [], tech_changes: [], timing_triggers: [] },
    risks_and_objections: { risk_bullets: [], likely_objections: [], landmines: [] },
    messaging: { cold_openers: [], value_props: [], call_to_action_ideas: [] },
    meta: { source, generated_at: '2026-10-14T19:00:00Z' },
  }
}
const quick = { mode: 'quick', data: data('quick'), legacy: {
  summary: 'Original quick summary', openingline: 'Original quick opener', talkingpoints: 'Quick point',
}}
const deep = { mode: 'deep', data: data('deep') }
const saved = {
  quick: mode === 'both' || mode === 'quick' ? quick : null,
  deep: mode === 'both' || mode === 'deep' ? deep : null,
}
const envelope = mode === 'legacy-deep' ? deep
  : mode === 'unknown' ? { data: { contact_profile: { headline: 'Unclassified older result' } } }
  : { ...saved.deep || saved.quick || {}, saved_results: saved }
;(window as any).__qaInitialEnvelope = envelope

function Fixture() {
  const [contact, setContact] = useState({
    id: 'qa-contact', first_name: 'Test', last_name: 'Contact', email: 'test@example.invalid',
    company: 'Synthetic company', enrichment_data: envelope,
  } as unknown as Contact)
  const [open, setOpen] = useState(true)
  return <>
    <button onClick={() => setOpen(true)}>Reopen contact</button>
    <button onClick={() => setContact({ ...contact, id: 'qa-contact-2', enrichment_data: {} } as Contact)}>
      Switch contact
    </button>
    <ContactDetailModal contact={contact} isOpen={open} initialTab="enrichment"
      onClose={() => setOpen(false)} onUpdate={setContact} />
  </>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
