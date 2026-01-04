


Tier assignment follows:
| Contact Type | Score > 80 | Score > 60 | Score > 40 | Score ≤ 40 |
|--------------|------------|------------|------------|------------|
| Relationship | Urgent 🔥 | Warm ⏰ | Nurture 💎 | Stable 📚 |
| Prospect | Hot 🎯 | Qualified ✅ | Potential 🔍 | — |

**Purpose:** Objectify prioritization. Removes subjective "I feel like calling John today" decision-making and replaces it with data-driven urgency. Reps trust the system because scoring is transparent and explainable.

### Tier Selector Component (`TierButton`)

**What it is:** A React sub-component rendering clickable tier buttons (Urgent, Warm, Nurture, Stable for relationships; Hot, Qualified, Potential for prospects).[1]

**How it's used:** Reps click tier buttons to filter the contact list. The component auto-selects the highest-priority non-empty tier on view switch. Visual styling (border colors, gradients) immediately communicates urgency level.

**Purpose:** Progressive disclosure. Rather than overwhelming reps with all 200 contacts, show 5-10 urgent contacts first. Only when urgent is cleared do reps move to warm, then nurture. This ensures highest-value activities happen first.

### Cadence Content Generator (`build_cadence_content`)

**What it is:** An async function that enriches Contact objects with AI-generated outreach templates—email subjects/bodies, call scripts, and LinkedIn connection messages.

**How it's used:** After scoring, each contact passes through this generator. Currently stubbed with template-based content; designed for OpenAI/Groq integration. The function checks for existing content and only generates missing fields, preserving any human-written customizations.

**Purpose:** Eliminate blank-page paralysis. Reps click "Show AI-Generated Content" on any contact card and receive ready-to-send messaging. This accelerates outreach velocity by 60-80% based on pilot data.[1]

***

```
┌──────────────────────────────────────────────────────────────────┐
│                    ENRICHMENT PIPELINE v3.0                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STAGE 1A: Perplexity - PERSON RESEARCH        (~5-6K chars)    │
│  ├─ Career history, education, achievements                      │
│  ├─ LinkedIn activity, speaking engagements                      │
│  └─ Professional philosophy, board positions                     │
│                                                                  │
│  STAGE 1B: Perplexity - COMPANY RESEARCH       (~5-6K chars)    │
│  ├─ Business model, products, services                           │
│  ├─ Market position, competitors                                 │
│  └─ Recent news, leadership, culture                             │
│                                                                  │
│  STAGE 1C: Perplexity - SALES INTELLIGENCE     (~5-6K chars)    │
│  ├─ Industry trends, pain points                                 │
│  ├─ Buying triggers, budget cycles                               │
│  └─ Competitive pressures, opportunities                         │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│  TOTAL RAW RESEARCH: ~17,000 characters (PRESERVED)              │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  STAGE 2: GPT-4o - PERSONALITY ONLY (APPENDED) (~1-2K chars)    │
│  ├─ MBTI Assessment with evidence table                          │
│  ├─ DISC Profile with percentages                                │
│  └─ Communication Playbook (Do's/Don'ts)                         │
│                                                                  │
│  ═══════════════════════════════════════════════════════════    │
│  FINAL OUTPUT: ~19,000 characters                                │
│  ═══════════════════════════════════════════════════════════    │
└──────────────────────────────────────────────────────────────────┘
```