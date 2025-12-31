# 🎉 LatticeIQ Frontend - Complete Architecture Walkthrough

You've built a **multi-page sales intelligence platform** with **3 major frameworks** (MDCP, BANT, SPICE). Here's what you have:

---

## **🏗️ ARCHITECTURE OVERVIEW**

```
Frontend (React + Vite + Tailwind)
├── Auth Layer (Supabase)
├── Pages (5 routes)
│   ├── LoginPage / SignupPage
│   ├── Dashboard (stats overview)
│   ├── ContactsPage (import + table)
│   ├── ScoringConfigPage (MDCP/BANT/SPICE frameworks)
│   ├── EnrichmentPage (TBD)
│   ├── SettingsPage (account info)
│   └── ProfileConfigPage (ICP definition)
├── Components
│   ├── Sidebar (navigation + logout)
│   ├── Layout (wrapper)
│   └── AddContactModal (new contact form)
└── Services
    └── contactsService (API client)

Backend (FastAPI + Supabase)
├── Auth (JWT validation)
├── Contact CRUD (apicontacts)
├── CRM Import (CSV, HubSpot, Salesforce, Pipedrive)
├── Enrichment V3 (Perplexity + GPT-4o)
└── Health checks

Database (Supabase Postgres + RLS)
└── contacts table (id, userid, firstname, lastname, email, company, title, phone, linkedin, enrichmentstatus, enrichmentdata, apexscore, mdcpscore, bantscore, spicescore, createdat)
```

---

## **📄 PAGE BREAKDOWN**

### **1. Dashboard** (`src/pages/Dashboard.tsx`)
**Purpose:** Executive overview of your contact database

**What it shows:**
- 📊 Total Contacts
- ✨ Enriched Contacts (count)
- 📈 Average MDCP Score
- 📊 Average BANT Score
- 🔥 High Priority Leads (MDCP > 80)

**How it works:**
```tsx
1. Load contacts from Supabase
2. Filter by enrichmentstatus === 'completed'
3. Calculate averages for MDCP, BANT scores
4. Display as stat cards + quick action links
```

**Key Features:**
- ✅ Real-time stats (recalculated on page load)
- ✅ Quick links to Contacts, Enrichment, Scoring pages
- ✅ Color-coded stat cards (cyan, green, purple, orange, red)

---

### **2. ContactsPage** (`src/pages/ContactsPage.tsx`)
**Purpose:** Import contacts + view contact table with scores

**What it shows:**
- 📥 Import dropdown (CSV, HubSpot, Salesforce, Pipedrive)
- 📋 Contact table with columns:
  - Name (first + last)
  - Company
  - Title
  - Email
  - MDCP Score
  - BANT Score
  - SPICE Score (coming)
  - Enrichment Status (pending/completed/processing/failed)

**How it works:**
```tsx
1. User selects import source (CSV or CRM)
2. Frontend calls:
   - CSV: POST /api/v3/crm/import/csv (with file)
   - HubSpot/Salesforce/Pipedrive: POST /api/v3/crm/import/{source}
3. Backend validates, deduplicates, saves to contacts table
4. Frontend refetches contacts and displays in table
5. User can add single contact via "Add Contact" button
```

**Key Features:**
- ✅ Multi-source import (CSV + 3 CRMs)
- ✅ Duplicate detection
- ✅ DNC (Do Not Call) filtering
- ✅ Success/error alerts
- ✅ Empty state with quick-action buttons
- ✅ Real-time score display

**API Endpoints Used:**
- `GET /api/contacts` - Fetch all contacts
- `POST /api/v3/crm/import/csv` - Import from CSV
- `POST /api/v3/crm/import/hubspot` - Import from HubSpot
- `POST /api/v3/crm/import/salesforce` - Import from Salesforce
- `POST /api/v3/crm/import/pipedrive` - Import from Pipedrive

---

### **3. ScoringConfigPage** (`src/pages/ScoringConfigPage.tsx`)
**Purpose:** Interactive guide to 3 sales qualification frameworks

**What it shows:**
- 🔘 Framework selector (MDCP, BANT, SPICE)
- 📖 Framework overview + description
- 🎯 Qualification thresholds (Hot/Warm leads)
- 🔓 Scoring dimensions (expandable cards)
  - Each dimension shows:
    - Name + description
    - Points value (e.g., +25)
    - Importance level (High/Medium/Low)
    - Examples of full points
    - Examples of partial points
- 📊 Framework comparison table (Methodology, Complexity, Sales Cycle, etc.)
- 🚀 Implementation guide (4-step process)
- ⚙️ Advanced configuration (threshold customization)

**Frameworks Explained:**

#### **MDCP (Money • Decision-Maker • Champion • Process)**
```
Best For: Enterprise SaaS, long sales cycles (90+ days)
Dimensions:
  - Money (Budget) → 25 points
  - Decision-Maker → 25 points
  - Champion (Internal Advocate) → 25 points
  - Process (Deal Timeline) → 25 points
Thresholds:
  - Hot: 80+ points
  - Warm: 60-79 points
```

#### **BANT (Budget • Authority • Need • Timeline)**
```
Best For: Mid-market, quick cycles (30-60 days)
Dimensions:
  - Budget → 25 points
  - Authority → 25 points
  - Need (Pain Point) → 25 points
  - Timeline → 25 points
Thresholds:
  - Hot: 80+ points
  - Warm: 60-79 points
```

#### **SPICE (Situation • Problem • Implication • Consequence • Economics)**
```
Best For: Consulting, custom solutions, complex deals
Dimensions:
  - Situation → 20 points
  - Problem → 20 points
  - Implication → 20 points
  - Consequence (Risk/Cost) → 20 points
  - Economics (ROI) → 20 points
Thresholds:
  - Hot: 85+ points
  - Warm: 65-84 points
```

**Key Features:**
- ✅ Tabbed exploration (3 frameworks)
- ✅ Expandable dimension details
- ✅ Real-world scoring examples
- ✅ Side-by-side framework comparison
- ✅ Customizable thresholds
- ✅ Implementation checklist

**Data Structure:**
```tsx
interface ScoringFramework {
  id: 'mdcp' | 'bant' | 'spice';
  name: string;
  title: string;
  description: string;
  dimensions: Array<{
    key: string;
    name: string;
    description: string;
    points: number;
    importance: 'high' | 'medium' | 'low';
  }>;
  hotThreshold: number;
  warmThreshold: number;
}
```

---

### **4. EnrichmentPage** (`src/pages/EnrichmentPage.tsx`)
**Status:** ⏳ Placeholder (minimal implementation)

**Expected Features (when built):**
- Async enrichment progress tracking
- View enrichment data (Perplexity 5-domain results)
- GPT-4o synthesis (talking points, hooks, objections)
- Queue management

---

### **5. SettingsPage** (`src/pages/SettingsPage.tsx`)
**Purpose:** Account management

**What it shows:**
- 👤 Current user email (from Supabase)
- 🔑 User ID (UUID)
- 🚪 Sign Out button

---

### **6. ProfileConfigPage** (`src/pages/ProfileConfigPage.tsx`)
**Status:** ⏳ Placeholder

**Expected Features:**
- ICP (Ideal Customer Profile) definition
- Persona configuration
- Industry/vertical filters

---

## **🧩 KEY COMPONENTS**

### **Sidebar** (`src/components/Sidebar.tsx`)
```tsx
Features:
- Collapsible navigation (toggle with button)
- Routes to all pages:
  - 📊 Dashboard
  - 👥 Contacts
  - ⭐ Lead Scoring
  - ✨ Enrichment
  - ⚙️ Settings
- Logout button
- Active route highlighting (cyan bg)
```

### **Layout** (`src/components/Layout.tsx`)
```tsx
Wraps authenticated pages with:
- Sidebar (navigation)
- Main content area (routes)
- Auth-protected (logged-in users only)
```

### **AddContactModal** (`src/components/AddContactModal.tsx`)
```tsx
Modal form to create single contact:
- Firstname
- Lastname
- Email
- Company
- Title
- Phone
- LinkedIn URL
```

---

## **🔐 AUTH FLOW**

```
1. User visits https://latticeiq.vercel.app
2. App checks Supabase session
   - If authenticated → Show Dashboard + Sidebar
   - If not → Show Login/Signup pages
3. Login/Signup calls Supabase Auth
4. On success → JWT token stored, session established
5. All subsequent API calls include Bearer token
6. Backend validates JWT in getcurrentuser middleware
7. Contacts filtered by userid (RLS enforced)
```

---

## **📊 DATA FLOW (Import → Score)**

```
Step 1: User Imports Contacts
  └─→ ContactsPage → POST /api/v3/crm/import/{source}
      └─→ Backend normalizes data (HubSpot → standardized Contact)
          └─→ Filters by DNC list, validates email
              └─→ Saves to Supabase contacts table
                  (enrichmentstatus = 'pending')

Step 2: User Views Dashboard
  └─→ Dashboard → GET /api/contacts
      └─→ Calculates stats (total, enriched, avg scores)
          └─→ Displays cards

Step 3: User Enriches (when implemented)
  └─→ ContactsPage → POST /api/v3/enrichment/enrich
      └─→ Backend runs 5 parallel Perplexity queries
          (COMPANY, PERSON, INDUSTRY, NEWS, OPENENDED)
              └─→ Merges results, calls GPT-4o for synthesis
                  └─→ Saves enrichmentdata to contacts table
                      (enrichmentstatus = 'completed')
                          └─→ Frontend refetches contacts
                              └─→ Displays enrichment + scores

Step 4: User Views Scoring Guide
  └─→ ScoringConfigPage
      └─→ Displays MDCP/BANT/SPICE frameworks
          └─→ No API calls (all client-side)
              └─→ User learns to score contacts manually or via backend
```

---

## **🚀 WHAT'S MISSING (TODOs)**

1. **Enrichment Triggering**
   - Add "Enrich Contact" button in ContactsPage
   - Wire to `POST /api/v3/enrichment/enrich`
   - Show progress spinner during enrichment

2. **Enrichment Display**
   - Create DetailView modal showing:
     - Raw enrichment data (Perplexity results)
     - Synthesized profile (GPT-4o output)
     - BANT/SPICE qualifications
     - Talking points, objections, hooks

3. **Batch Scoring**
   - Bulk actions: Select multiple contacts
   - Score all at once (backend batching)

4. **CRM Integrations**
   - Store HubSpot/Salesforce/Pipedrive API keys in Settings
   - Sync back enrichment data to CRM

5. **Analytics**
   - Win/loss tracking
   - Framework effectiveness metrics
   - Score-to-close-rate correlation

---

## **🎯 NEXT IMMEDIATE ACTIONS**

### **Option A: Add Enrichment UI** (30 mins)
```tsx
// In ContactsPage, add Enrich button for each contact
// When clicked: POST /api/v3/enrichment/enrich?contactid=...
// Poll status: GET /api/v3/enrichment/{id}/status
// Refetch contact when complete
```

### **Option B: Create DetailView Modal** (1 hour)
```tsx
// Show enrichment data when user clicks contact row
// Display tabs:
// - Profile (synthesis)
// - Raw Data (Perplexity results)
// - BANT (qualification)
// - SPICE (qualification)
```

### **Option C: Batch Enrich** (1 hour)
```tsx
// Add checkbox to table rows
// "Enrich Selected" button
// POST /api/v3/enrichment/batch with array of contactids
// Track progress with async queue
```

---

## **🧪 TESTING CHECKLIST**

- [ ] Login/Signup works
- [ ] Dashboard loads and calculates stats
- [ ] Can import CSV contacts
- [ ] Can import from HubSpot (if creds configured)
- [ ] ContactsPage table displays all contacts
- [ ] ScoringConfigPage loads all 3 frameworks
- [ ] Can expand/collapse dimensions
- [ ] Settings page shows user info + sign out
- [ ] Sidebar navigation works (all routes clickable)
- [ ] Logout clears session

---

## **📦 DEPLOYMENT STATUS**

✅ **Frontend:** Deployed to Vercel (https://latticeiq.vercel.app)
✅ **Backend:** Deployed to Render (https://latticeiq-backend.onrender.com)
✅ **Database:** Supabase Postgres with RLS
✅ **Build:** `npm run build` passes (zero errors)
✅ **Env vars:** VITE_API_URL configured

---

## **🎨 DESIGN SYSTEM**

Using **Tailwind CSS v4** with custom color palette:
- **Primary (Cyan):** `text-cyan-400`, `bg-cyan-600`
- **Success (Green):** `text-green-400`, `bg-green-900`
- **Warning (Orange):** `text-orange-400`, `bg-orange-900`
- **Error (Red):** `text-red-400`, `bg-red-900`
- **Background:** `bg-gray-900`, `bg-gray-800`, `bg-gray-950`
- **Text:** `text-white`, `text-gray-400`

Typography:
- Headings: `text-2xl font-bold`
- Body: `text-sm`, `text-gray-400`
- Monospace: `font-mono` (for UUIDs, IDs)

Spacing:
- Padding: `p-4`, `p-6`, `p-8`
- Margins: `mb-8`, `space-y-6`
- Gap: `gap-4`, `gap-8`

---

## **🔗 QUICK LINKS**

- **Frontend:** https://latticeiq.vercel.app
- **Backend API:** https://latticeiq-backend.onrender.com
- **API Docs:** (POST /api/contacts, /api/v3/enrichment/*, /api/v3/crm/import/*)
- **Supabase Dashboard:** (contacts table schema)
- **Vercel Dashboard:** (deployments)
- **Render Dashboard:** (backend logs)

---

**Ready to build more features? Pick one from the TODOs above!** 🚀
