## Changelog
- 2026-05-11: Initial design — People, Companies, Touches, Talking Points, Morning Routine, Weekly Review


# **🛠 BD System — Build & Reference**

> **Living reference for the Business Development & Marketing system. Built around deliberate, low-volume, high-intent relationship building for SBA / CRE lending. Last updated: May 11, 2026.**
> 

---

## **📖 1. Overview & Philosophy**

The job of this system is to answer four questions every morning:

1. Who should I call today, and why?
2. Who haven't I touched in too long?
3. What do I say when I reach them?
4. Should I send a flyer, a rate update, a referral ask, or just a check-in?

**Core principles**

- HubSpot stays the system of record for deals (when sync is possible later).
- Notion is the **BD cockpit** — relationship intelligence, talking points, and daily orchestration.
- No bulk mail. Targeted, intentional, one-to-three at a time.
- Manual logging by design — the friction is the filter. Only meaningful touches make it in.
- Cadence math is the engine. Last Contact + Cadence = Next Touch Due.
- 25 Tier-A relationships, well-loved, beat 500 contacts in a CRM graveyard.

---

## **🗺 2. System Map**

**Active databases (5)**

- People — the spine
- Companies — light grouping
- Touches — interaction log
- Talking Points — template / script library
- Tasks — existing, lightly extended

**Active pages (2)**

- 🌅 BD Morning Routine — daily front door
- 🪞 Weekly Review — Friday strategic check-in

**On deck (later)**

- Campaigns DB
- MCP / AI wiring
- Deals DB (when HubSpot sync resolves)
- Referrals, Events, Newsletter, Year-End Review (when needed)

---

## **👥 3. People DB**

> **Click toggle to expand**
> 

<details>

<summary><b>Full People DB Spec</b></summary>

**Properties**

| **#** | **Name** | **Type** | **Options / Formula** |
| --- | --- | --- | --- |
| 1 | Name | Title | — |
| 2 | Company | Relation | → Companies DB |
| 3 | Title / Role | Text | — |
| 4 | Email | Email | — |
| 5 | Mobile | Phone | — |
| 6 | Office | Phone | — |
| 7 | City | Text | — |
| 8 | Market | Select | Ventura, LA, OC, SD, IE, Other |
| 9 | Relationship Type | Select | COI, Broker, Referral Partner, Past Borrower, Prospect Borrower, Banker, Attorney, CPA, Realtor, Friend/Personal, Cold Lead |
| 10 | Tier | Select | A, B, C, D (A=red → D=gray) |
| 11 | Cadence | Select | Weekly, Biweekly, Monthly, Quarterly, Semi-annual, Ad-hoc |
| 12 | Cadence Days | Formula | `if(prop("Cadence") == "Weekly", 7, if(prop("Cadence") == "Biweekly", 14, if(prop("Cadence") == "Monthly", 30, if(prop("Cadence") == "Quarterly", 90, if(prop("Cadence") == "Semi-annual", 180, 9999)))))` |
| 13 | Last Contact (auto) | Rollup | Relation: Touches → Property: Date → Latest |
| 14 | Next Touch Due | Formula | `dateAdd(prop("Last Contact (auto)"), prop("Cadence Days"), "days")` |
| 15 | Days Until Due | Formula | `dateBetween(prop("Next Touch Due"), now(), "days")` |
| 16 | Status | Select | Active, Warm, Cold, Paused, Do Not Contact |
| 17 | Source | Select | Referral, LinkedIn, Event, Cold outreach, Past deal, Personal, Other |
| 18 | Source Detail | Text | — |
| 19 | Last Deal With | Text | — |
| 20 | Tags | Multi-select | SBA-friendly, CRE-broker, Industrial focus, Retail focus, Office focus, Hospitality, Owner-occupied, Investor, etc. |
| 21 | Personal Notes | Rich text | Family, hobbies, recent life events |
| 22 | Touches | Relation | → Touches DB |

**Views**

- 🔥 Due Today — `Days Until Due ≤ 0` AND `Status ≠ Do Not Contact`, sort: Tier asc, Last Contact asc
- 📅 This Week — `Days Until Due ≤ 7`
- 🅰️ Tier A — All — `Tier = A`
- 🧊 Going Cold (A/B) — `Tier = A or B` AND `Days Until Due ≤ -14`
- 🤝 COIs & Brokers — Relationship Type filter, grouped by Tier
- 🆕 No Last Contact Yet — `Last Contact is empty`
- 📇 All — Table

</details>

---

## **🏢 4. Companies DB**

<details>

<summary><b>Full Companies DB Spec</b></summary>

**Properties**

- Name (Title)
- Type (Select): Operating company, RE holding, Guarantor, Brokerage, CPA firm, Law firm, Bank, Insurance, Other
- Industry (Select)
- City (Text)
- Website (URL)
- Primary Contact (Relation → People)
- Contacts (Relation ← People)
- Touches (Relation ← Touches)
- Notes (Rich text)

Keep it light. Companies is mostly a grouping/dossier table.

</details>

---

## **📞 5. Touches DB**

<details>

<summary><b>Full Touches DB Spec</b></summary>

**Properties**

| **#** | **Name** | **Type** | **Options** |
| --- | --- | --- | --- |

| **#** | **Name** | **Type** | **Options** |
| --- | --- | --- | --- |
| 1 | Title | Title | "[Type] – [Person] – [Topic]" |
| 2 | Date | Date (with time) | — |
| 3 | Type | Select | Call (connected), Call (VM), Email out, Email in, Text, LinkedIn, In-person meeting, Coffee/Lunch, Event, Flyer/Blast, Gift, Other |
| 4 | Direction | Select | Outbound, Inbound |
| 5 | People | Relation | → People |
| 6 | Company | Relation | → Companies |
| 7 | Outcome | Select | Connected, Left VM, No answer, Replied, Meeting set, Deal lead, Referral given, Referral received, No interest, Bounced, Pending |
| 8 | Summary | Rich text | — |
| 9 | Follow-up needed? | Checkbox | — |
| 10 | Follow-up by | Date | — |
| 11 | Follow-up action | Text | One line |
| 12 | Linked Campaign | Relation | → Campaigns (future) |
| 13 | Linked Deal | Text | — |
| 14 | Channel | Select | Phone, Email, SMS, Zoom/Teams, In-person, LinkedIn, Other |
| 15 | Owner | Person | — |
| 16 | Sentiment | Select | 🔥 Hot / 👍 Positive / 😐 Neutral / 👎 Cool / ❄️ Cold |

**Touches DB Views** (continued from where Part 1 cut off)

- 🗓 Today's Touches — `Date = today`, sort: Date desc
- 📋 This Week — `Date within past 7 days`, group by Day
- 🔁 Follow-ups Due — `Follow-up needed = true AND Follow-up by ≤ today`
- 🔥 Hot Leads — `Outcome = Deal lead OR Sentiment = 🔥`
- 📬 Inbound Tracker — `Direction = Inbound`
- 🎯 By Campaign — Group: Linked Campaign
- 🗂 All — Table

**Critical setup**: On People DB, the "Last Contact (auto)" property is a **rollup** of Touches → Date → Latest. This drives the entire cadence engine. Every logged Touch automatically updates Next Touch Due.

---

## **💬 6. Talking Points DB**

> **Template / script library**
> 

**Properties**

| **Field** | **Type** | **Options** |
| --- | --- | --- |
| Title | Title | "COI Quarterly Check-In — Email" |
| Scenario | Select | COI quarterly, Broker rate update, Past borrower anniversary, Prospect follow-up, Going cold re-engagement, Rate flyer, Event invite, Referral thank-you |
| Channel | Select | Email, Text, Voicemail, LinkedIn, In-person |
| Audience Tier | Multi-select | A, B, C |
| Relationship Type | Multi-select | COI, Broker, Past Borrower, Prospect, Cold Lead |
| Body | Rich text | (template content) |
| Variables | Text | List of `[brackets]` to fill |
| Last Updated | Date | — |
| Usage Notes | Rich text | Tips, what works, what doesn't |

**Seeding**: Load the 5 templates below × 3 channels each = 15 entries.

---

## **✉️ 7. Touch Templates (5 scenarios × 3 channels each)**

## **Template 1 — COI Quarterly Check-In**

**When**: Tier-A CPA/attorney/escrow/insurance/wealth advisor untouched ~90 days. Lead with useful, not "checking in."

**📧 Email**

> **Subject: Checking in — and a quick SBA update you might find useful
Hi [First name],
It's been a few months since we connected — wanted to drop a quick note to say hi and share something I've been seeing on my end.
[Pick one:]
• SBA 7(a) is back to allowing partner buyouts under the simplified change-of-ownership rules — cleaner for clients exploring succession.
• 504 fixed rates dropped about [X] bps last month, which is moving some clients off the fence on owner-occupied real estate.
• I closed a [type] deal last week that started exactly like a conversation you and I had a while back — happy to share how it played out if useful.
No agenda — just thinking of you. If you've got a client situation rattling around where an SBA or CRE conversation might help, you know where to find me.
Coffee in the next few weeks?
Chris**
> 

**💬 Text**

> **Hey [First name] — been a while. SBA 7(a) just loosened up on partner buyouts; thought of you. Got time for coffee in the next couple weeks?**
> 

**☎️ Voicemail**

> **Hey [First name], Chris Rabenold. No fire, just checking in — it's been a few months. A couple things have moved on the SBA side that might be useful for one or two of your clients, and I'd love to grab coffee if you've got a window in the next couple weeks. Give me a ring back at [number] or shoot me a text. Talk soon.**
> 

---

## **Template 2 — CRE Broker Rate / Market Update**

**When**: Monthly-biweekly cadence broker. Goal: be the SBA/CRE lender they think of first.

**📧 Email**

> **Subject: Quick rate snapshot + one structure that's been working
[First name],
Sending the monthly cheat-sheet so you've got fresh numbers when an owner-user deal comes across:
• SBA 7(a): Prime + [spread]% = ~[X]% start rate, 25 yr fully amortized
• SBA 504: ~[X]% 25-yr fixed on the second
• Conventional CRE (owner-occupied): [X]–[X]% / 25-yr am / 5-7 yr fixed
One structure that's been getting deals done lately: [brief 1-2 sentence example of a recent creative structure].
Anything in your pipeline I should be looking at? Happy to pre-screen anything murky before you send it formal.
— Chris**
> 

**💬 Text**

> **[First name] — Updated rate sheet for the month: 7(a) ~[X]%, 504 ~[X]%, conv CRE ~[X]%. Anything in your book to pre-screen?**
> 

**☎️ Voicemail**

> **Hey [First name], Chris. Quick one — fresh rate numbers for the month, and I've been seeing some creative structures work lately on owner-user deals. Wanted to see what's in your pipeline and if there's anything I could pre-screen for you. Give me a buzz back at [number] when you've got a sec.**
> 

---

## **Template 3 — Past Borrower Anniversary**

**When**: Loan anniversary or quarterly. Highest-conversion referral source, most-underserved.

**📧 Email**

> **Subject: Hard to believe it's been [N] year(s) — how's [Company]?
Hi [First name],
Looked at the calendar and realized we closed your [loan type] [N] year(s) ago this month. Time flies.
Genuinely curious — how are things going at [Company]? Is the [property/equipment/expansion the loan funded] doing what you hoped?
Two things worth mentioning, no pressure either way:
1. If rates have moved enough to make a refi worth a 10-minute conversation, I'll tell you straight whether it pencils.
2. If you've got friends or peers in business who own (or want to own) their real estate, I'd be honored if I came up in the conversation.
Either way — would love to catch up. Lunch on me sometime this month?
— Chris**
> 

**💬 Text**

> **Hey [First name] — realized it's been [N] year(s) since we closed [Company]'s loan. How's everything? Worth a quick lunch this month?**
> 

**☎️ Voicemail**

> **Hey [First name], Chris Rabenold. Hard to believe it's been [N] year(s) since we got [Company]'s loan closed. Just calling to say hi and see how things are going — no agenda. If you've got a few minutes for lunch this month I'd love to catch up. Number's [number]. Talk soon.**
> 

---

## **Template 4 — Prospect / Active Deal Follow-Up**

**When**: Live deal gone quiet. Re-engage without nagging.

**📧 Email**

> **Subject: [Deal/Company] — where are we?
Hi [First name],
Wanted to circle back on [deal/company]. Last we talked, [one-sentence summary of the open item].
A few possibilities I'm working with on my end:
• If [open item] is close, we can keep this moving toward [target close date].
• If it's stalled, let me know what's in the way — there's almost always a workaround.
• If priorities have shifted and this needs to pause, totally fine — just want to make sure I'm not chasing something that's no longer live.
What's the right next step?
— Chris**
> 

**💬 Text**

> **[First name] — just checking on [deal]. Where are we on [open item]? Want to make sure I'm helping not nagging. Let me know.**
> 

**☎️ Voicemail**

> **Hey [First name], Chris. Just checking in on [deal]. Last conversation, you were going to chase down [open item] — want to see where that landed and what I can do to help move it forward. If priorities have shifted that's fine too, just want to know where we stand. Give me a ring back at [number].**
> 

---

## **Template 5 — Going-Cold Re-Engagement (A/B Tier, 60-90 days quiet)**

**When**: Tier A/B significantly past cadence window. Break the silence without seeming transactional.

**📧 Email**

> **Subject: [First name] — overdue note from me
Hi [First name],
Confession: I looked at my list this morning and realized I haven't reached out in [N] months. That's on me.
[Pick one personal hook:]
• How did [thing they mentioned last time] turn out?
• I saw [news/industry thing] recently and it made me think of our last conversation about [topic].
• I've been heads-down on a few deals and let too many good relationships go quiet — yours is one of them.
No specific ask. Just wanted to say I'm still here, still in the SBA/CRE game, and would love to grab coffee or lunch when you've got a slot. My calendar is open the next couple weeks.
— Chris**
> 

**💬 Text**

> **[First name] — realized I've been quiet way too long. No agenda, just thinking of you. Coffee or lunch in the next couple weeks?**
> 

**☎️ Voicemail**

> **Hey [First name], Chris Rabenold. I owe you a call — it's been too long, that's on me. No reason for the call other than to say hi and see how you're doing. If you've got a window for coffee or lunch in the next couple weeks I'd love to make it happen. Number's [number]. Talk soon, [First name].**
> 

---

## 

## **🌅 8. Morning Routine Page Spec (full)**

> **Build as a separate Notion page at the top of your sidebar. Pin it.**
> 

**Page structure**

- **Header**: "🌅 Good Morning, Chris — Today is {date}. One day at a time."
- **☕ Centering** (2 min) — two toggles:
    - "What am I building this week?"
    - "Who am I being today?"
- **🎯 Today's Focus** (3 min) — three checkboxes:
    - Top BD priority for today
    - Top deal priority for today
    - One personal/relational win I want
- **📤 Today's Send Queue** — manual checklist of 3–5 targeted sends/calls planned this morning
- **☎️ Call List — Due Today** — linked view of People DB "🔥 Due Today" (board grouped by Tier, or table sorted Tier → Last Contact)
- **🔁 Hot Follow-ups** — linked view of Touches DB "Follow-ups Due"
- **🧊 Going Cold — A/B** — linked view of People DB "Going Cold (A/B)" — collapsed by default
- **✅ Today's Tasks** — linked view of Tasks DB filtered Due=today, Owner=me
- **📝 Daily Log** — inline mini-database, one row per day, with fields:
    - Date (Title or Date)
    - Touches made (Number)
    - Wins (Rich text)
    - Friction (Rich text)
    - Tomorrow's #1 priority (Text)
    - Mood / energy (1–5)
- **🧠 End-of-Day Shutdown** — checklist:
    - Logged today's touches
    - Updated Last Contact on people I reached
    - Reviewed tomorrow's Due Today
    - Closed open loops / sent pending replies
    - Wrote one line in Daily Log

**Suggested template button**: "▶️ Start Today's Log" — creates a new Daily Log row pre-filled with today's date and the shutdown checklist.

---

## **🪞 9. Weekly Review Page Spec**

> **Friday afternoon, 20 min, with coffee or a walk after. Make it a ritual.**
> 

**Page structure**

- **Header**: "🪞 Weekly Review — Week of [date]"
- **📈 By the Numbers** (3 min) — rollups/manual counts from Touches DB this week:
    - Total Touches logged (Calls / Emails / Texts / In-person)
    - Replies received
    - Meetings set
    - Deal leads generated
    - New people added
- **✅ Wins** (3 min) — what went well, where effort paid off
- **😬 Friction** (3 min) — what didn't work, what got skipped, what I avoided
- **🔍 Pattern Spotting** (5 min):
    - Who responded warmly — invest more?
    - Who went cold — one more try, or step back?
    - Which template/approach worked best?
    - Which Tier-A's am I neglecting?
- **📋 Pipeline Pulse** (3 min) — linked view of Touches with Outcome = Deal lead in past 30 days
- **🎯 Next Week's Focus** (3 min):
    - 3 people I'm committing to reach
    - 1 campaign or theme to push
    - 1 relationship to invest in deeply
    - 1 thing to stop doing or skip
- **📝 One-Sentence Reflection** — "This week was: "
- **🔁 Maintenance** (2 min) — checklist:
    - Review People DB — anyone Tier needs adjusting?
    - Update Cadence settings that don't match reality
    - Clean up "Going Cold (A/B)" — close out names that won't re-engage
    - Glance at Inbox section — promote/discard ideas

---

## **🌱 10. Tier-A Seed Strategy**

**The principle**: 25 people, if touched intentionally with something useful, would meaningfully move your pipeline. That's the bar.

**The 5 buckets (≈5 each)**

1. **Top 5 COIs / Referral Sources** — CPAs, attorneys, escrow, insurance, wealth advisors. Cadence: quarterly minimum, ideally every 6 weeks.
2. **Top 5 CRE Brokers** — close owner-user CRE and small-balance investment deals in your markets. Cadence: monthly to biweekly.
3. **Top 5 Past Borrowers** — people you've closed for. Refer, refinance, expand. Cadence: quarterly + loan anniversary.
4. **Top 5 Active/Warm Prospects** — live deals or near-live conversations. Cadence: weekly to biweekly until resolved.
5. **Top 5 "Aspirational" Relationships** — people you don't know well yet but should. Cadence: monthly outreach until you break in or decide to stop.

**Method**: List 25 names *from memory* in one sitting. From-memory = top-of-mind = right filter. For each: company, relationship type, why Tier A, rough cadence. Then enter in People DB with Last Contact = your best guess. The formula will tell you who's already overdue.

**Math**: 25 people × ~6 touches/year = 150 intentional touches/year ≈ 3 per week. Completely manageable.

**What counts as a touch**: Email, text, LinkedIn comment, coffee/lunch, flyer when relevant, birthday acknowledgment, sending *them* a referral. Mix it up.

---

## **⏰ 11. Daily Rhythm**

**Morning (10 min)**

- Centering toggles (2 min)
- Set today's 3 priorities (3 min)
- Build Send Queue — scan Due Today + Hot Follow-ups, pick 3–5 (5 min)

**Throughout the day**

- Execute Send Queue (copy template from Notion or text expander → personalize → send from Outlook)
- Log each touch in Notion immediately (or batch at lunch + EOD)
- Update Last Contact (or trust rollup if Touches relation is set)

**EOD (5 min)**

- Shutdown checklist
- One sentence in Daily Log
- Glance at tomorrow's Due Today

**The non-negotiable habit**: log Touches accurately. Everything else flows from this.

---

## **🛠 12. Build Order**

- Companies DB (5 min) — minimal: Name, Type, City, Notes
- People DB + formulas (30 min)
- Copy email + phone from Outlook for top 25 (15 min, one-time)
- Seed 25 Tier-A names (45 min)
- Touches DB + Last Contact rollup on People (20 min)
- Talking Points DB + 15 template entries (5 scenarios × 3 channels) (30 min)
- Load templates into Raycast / text expander snippets (15 min)
- 🌅 Morning Routine page with Send Queue (25 min)
- 🪞 Weekly Review page (15 min)
- Use for 2 weeks daily + 2 Friday reviews
- Add Campaigns DB if/when it feels needed
- Add MCP / Notion AI wiring once data is real

**Total upfront**: ~3.5–4 hours, spread over 2–3 evenings.

---

## **📦 13. Future Extensions Inbox**

> **Dumping ground for "I should add X someday" ideas. Review weekly. Promote to real builds only when they've earned it.**
> 
- Referrals DB (attribution analysis)
- Events DB (networking events + who I met)
- Newsletter / Content DB (if I start a series)
- Deals DB (when HubSpot sync resolves)
- Year-End Annual Review template
- Monthly Review template
- Thinking Prompts library for Personal Notes
- Add ideas as they come up:
    - 
    - 
    - 

---

## **📝 14. Working Notes**

> **My running log of decisions, friction, and ideas as I build and use this system.**
> 

**Decisions made**

- May 11, 2026 — System designed. Notion = BD cockpit; HubSpot = deal record (no sync available, manual paste OK). No bulk mail — targeted, intentional, low-volume. 25 Tier-A focus.

**Friction observed**

- 

**Ideas / refinements**

- 

---

## **🗂 15. Future Items Queue (drafts pending)**

When ready, these are the remaining pieces Comet has on deck to draft:

1. **3 more touch templates**: Referral Thank-You, Rate Drop / News Flyer, Event Follow-Up
2. **Inbound-reply micro-workflow** — clean way to handle Outlook replies → Touches
3. **Monthly Review template** — broader-horizon, 30 min, last Friday of month
4. **Thinking Prompts library** for Personal Notes field — deep questions to deepen Tier-A relationships
5. **Year-End Annual Review** — relationship audit + next year's plan
6. **Campaigns DB spec** — when ready to coordinate marketing pushes
7. **MCP / Notion AI wiring guide** — when data has 2–3 weeks of real use

---

## **✉️ 7b. Touch Templates — Additional 3**

## **Template 6 — Referral Thank-You**

**When**: Someone just sent you a deal, an intro, or a name. Close the loop loudly within 24 hours. This is the single most under-utilized BD move — most lenders just say "thanks, I'll reach out." The ones who thank meaningfully get sent more.

**📧 Email**

> **Subject: Thank you — and I'm on it
[First name],
Just got your intro to [Name / Company]. Thank you — it genuinely means a lot that you thought of me.
Here's what I'm doing in the next 24 hours:
• Reaching out to [Name] today to set up a call
• I'll get back to you within a week to let you know how the conversation went, win or lose
If this turns into something, you'll be the first to know. If it doesn't, I'll tell you why, so you have better intel for next time.
Lunch is on me next time we connect — overdue anyway.
— Chris**
> 

**💬 Text**

> **Just got your intro to [Name] — thank you. I'll reach out today and circle back with you by end of week either way. Lunch on me next time.**
> 

**☎️ Voicemail**

> **Hey [First name], Chris. Just got your intro to [Name] — wanted to call and say thank you directly. I'll reach out to them today and I'll get back to you within a week with how it lands, good or bad. Really appreciate you thinking of me. Lunch is on me next time. Talk soon.**
> 

🧠 The "circle back within a week regardless of outcome" promise is the magic. It tells the referrer their intro mattered enough to track, and it gives them feedback to refine future intros. Almost no one does this. Doing it consistently builds a referral flywheel.

---

## **Template 7 — Rate Drop / News Flyer**

**When**: A meaningful rate move (≥25 bps) or SBA/program change worth sharing. Send to a *targeted* segment — not everyone. Filter People DB by Tier A/B + relationship type (Brokers, COIs, Past Borrowers) and select 5–15 names where this news is actually relevant.

**📧 Email**

> **Subject: Quick heads-up — [SBA 7(a) / 504 / Prime] just moved [direction] [X] bps
Hi [First name],
Short note — Prime just dropped [X] bps as of [date], which puts SBA 7(a) start rates around [X]% on 25-yr fully amortized money. 504 fixed is now ~[X]% on the second.
Why I'm sending this to you specifically: [pick one — *"You mentioned [Client] was on the fence about refi"* / *"Your industrial deals tend to pencil better at this level"* / *"Past borrowers in your situation often refi when we cross [X]%"*].
If it's worth a 10-minute conversation for one of your situations (or your own), let me know — I'll run quick numbers and tell you whether it actually makes sense.
Either way, just wanted you on the inside track.
— Chris**
> 

**💬 Text**

> **[First name] — quick heads-up: Prime dropped [X] bps, 7(a) now ~[X]%. Worth a look at [the client/deal we discussed]?**
> 

**☎️ Voicemail**

> **Hey [First name], Chris. Two-minute call — Prime just moved [X] bps and I wanted to make sure you knew before everyone else does. 7(a) start rates are now around [X]%. I'm thinking specifically about [the deal/client we discussed] but it might apply to others in your book. Give me a buzz and I'll run quick numbers. Number's [number].**
> 

🧠 The personalization line ("why I'm sending this to you specifically") is the entire game. A generic blast gets ignored. A note that says "I'm sending this *because* of [specific thing about you/your business]" gets read and responded to. Spend 30 extra seconds per send to add this line — it's worth more than any subject-line A/B test.

---

## **Template 8 — Event Follow-Up**

**When**: Day after (or within 48 hours of) a networking event, conference, lunch, or industry gathering where you met someone worth following up with. Strike while names and faces are fresh.

**📧 Email**

> **Subject: Great to meet you at [event] — [reference specific thing you discussed]
Hi [First name],
Really enjoyed meeting you at [event] yesterday. [One specific thing from your conversation — e.g., "Your point about industrial absorption in the Conejo Valley was a perspective I hadn't heard before"].
A couple of follow-ups from our conversation:
1. [Specific thing you said you'd send — article, intro, info]
2. [Specific thing you said you'd do — schedule lunch, call them on X, etc.]
Want to put a 30-min coffee on the calendar in the next 2–3 weeks? I'm thinking [propose 2 specific times]. If neither works, send me three windows that do.
Looking forward to it.
— Chris
P.S. Connecting on LinkedIn — sent you a request.**
> 

**💬 Text**

> **[First name] — great meeting you at [event]. Coffee in the next couple weeks? I'll send [thing] over by EOD today.**
> 

**☎️ Voicemail**

> **Hey [First name], Chris Rabenold — we met at [event] yesterday. Really enjoyed the conversation about [topic]. Calling to say it was great to meet you, and to suggest grabbing coffee in the next couple weeks. I'll shoot you an email with a couple times. Look forward to it.**
> 

🧠 Two non-obvious moves here: (1) referencing a *specific* point they made shows you actually listened, which 90% of follow-ups don't do; (2) proposing 2 concrete times beats "let me know your availability" — friction kills coffee dates. Also, **always send the follow-up within 48 hours**. After that, the warmth is gone and you're a stranger again.

---

## **📥 16. Inbound-Reply Micro-Workflow**

> **The one real friction gap in a manual system: replies sit in Outlook and need to make it into the Touches DB. Here's the cleanest workflow.**
> 

**The principle**: Don't try to log every email instantly. Replies arrive throughout the day; context-switching to Notion every time will break your focus. Instead, **batch them at three natural pause points**.

## **The 3-touch-point workflow**

**1. Inbox triage (when you check email, 3–4× a day)**

When a reply comes in:

- **Action it immediately** if it takes <2 minutes (reply, forward, archive). Don't context-switch to Notion.
- **Flag it in Outlook** with a category or follow-up flag if it needs more thought.
- **Tag it mentally**: is this a meaningful interaction worth logging?

🧠 Most email replies don't need to be logged. "Sounds good, talk Tuesday" is not a Touch. "Yes, I'd love to refer my client Jane Smith — here's her info" *is* a Touch and gets logged.

**2. Lunch-time batch (5 min, ~12:30 PM)**

Open Outlook → sort Inbox by "Today" → for any meaningful inbound replies:

- Switch to Notion Touches DB → New entry
- Type = "Email in", Direction = "Inbound", Date = today
- People = relation to who replied
- Summary = paste 1-2 sentences of substance (not the full email — just what mattered)
- Outcome = Replied, or Meeting set, or Deal lead, etc.
- Follow-up needed? Check if yes, set Follow-up by date.

This takes ~30 seconds per reply. Even on a busy day, you might log 3–6 inbound touches at lunch.

**3. EOD sweep (3 min, end of day)**

As part of your shutdown ritual:

- Open Outlook Sent folder → today's filter
- For each meaningful outbound email/text/call you made today that you haven't logged yet → quick Touch entry
- Re-check Inbox for any replies that came in after lunch → log if meaningful
- Update Last Contact (or trust the rollup) on the relevant People

## **The "meaningful" filter**

What's worth logging:

- ✅ Substantive replies (advancing a conversation, giving info, asking a question)
- ✅ Meeting confirmations or new meeting requests
- ✅ Referrals — both given and received
- ✅ Anything that changes how/when you'd reach out next
- ✅ Anything that hints at sentiment shift (warming up, cooling down)

What's not worth logging:

- ❌ "Thanks!"
- ❌ "Got it"
- ❌ Out-of-office auto-replies
- ❌ Calendar accepts (the meeting itself becomes the Touch when it happens)
- ❌ One-line acknowledgments with no new info

🧠 If you're not sure, lean toward *not* logging. A signal-rich DB with 60 entries beats a noisy DB with 600. You can always add it later if it turns out to matter.

## **The "Email in" Outlook shortcut**

To speed up the paste-to-Notion step:

**Option A — Text expander snippet**: `;logreply` expands to a structured template you fill in:

`textType: Email in
Person: [Name]
Date: [today]
Subject: [from Outlook]
Summary: [1-2 sentences]
Outcome: [Replied / Meeting set / Deal lead / etc.]
Follow-up: [yes/no, date]`

Paste that into a new Touches row → fill the brackets → done in 20 seconds.

**Option B — Raycast / Notion deeplink**: Bookmark a Raycast command "New Touch" that opens Notion directly to a new pre-filled Touches entry. One hotkey, no clicking through Notion's sidebar.

**Option C — The "lazy log"**: Forward the email to yourself with "LOG:" in the subject and a one-line note. At EOD, scan your "LOG:" forwards and create Touches from them. Less elegant, zero context-switching during the day.

🧠 Pick whichever feels lightest. The goal is to make logging take less mental energy than *not* logging. If logging feels heavier, you'll skip it.

## **Calendar / meetings**

Outlook calendar meetings are a special case. Two options:

1. **Pre-meeting**: When you accept the calendar invite, immediately create a Touches entry with Type = "In-person meeting" or "Coffee/Lunch", Date = meeting date, Outcome = "Pending". After the meeting, update Outcome + Summary.
2. **Post-meeting only**: Skip the pre-entry, create the Touch right after the meeting ends (in your car, on phone via Notion mobile, with iOS dictation for the summary).

Option 2 is leaner. Recommended.

## **Cadence rollup behavior**

Important: since "Last Contact (auto)" on People DB is the **latest Touch Date**, *inbound* replies will count toward keeping a relationship "fresh" in the cadence math. This is correct behavior — if someone reached out to *you*, you don't need to re-reach-out for the cadence period.

But: an inbound reply should typically trigger an *outbound follow-up* (especially for Tier-A). Use the "Follow-up needed?" checkbox on the inbound Touch to make sure you respond within 24–48 hours.