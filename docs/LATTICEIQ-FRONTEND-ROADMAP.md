# LatticeIQ Frontend - Tailwind Integration Roadmap

## ENGINEERING LEAD SUMMARY

As Lead Engineer, I'm delivering a **production-ready React/TypeScript/Tailwind frontend** for LatticeIQ that:

✅ **Reuses all Apex business logic** through clean API layer
✅ **Implements enterprise design system** with Tailwind tokens
✅ **Provides modular component architecture** for rapid feature development
✅ **Enables multi-tenant SaaS patterns** from day 1
✅ **Includes comprehensive error handling** & optimistic UI patterns
✅ **Supports real-time updates** (polling, WebSocket-ready)
✅ **Full TypeScript coverage** for type safety

---

## PROJECT STRUCTURE

```
latticeiq-frontend/
├── tailwind.config.ts                 # Design system tokens (extended)
├── tsconfig.json                       # Strict TypeScript config
├── vite.config.ts                      # Build config with optimizations
├── src/
│   ├── main.tsx                        # Entry point
│   ├── App.tsx                         # Router setup
│   ├── index.css                       # Tailwind directives
│   │
│   ├── config/
│   │   ├── api.ts                      # API endpoints & base URL
│   │   ├── constants.ts                # App-wide constants
│   │   └── theme.ts                    # Design tokens (duplicated from Tailwind for runtime)
│   │
│   ├── types/
│   │   ├── contact.ts                  # Contact model + API responses
│   │   ├── qualification.ts            # Scoring models (APEX, BANT, SPICE)
│   │   ├── user.ts                     # User & auth models
│   │   ├── enrichment.ts               # Enrichment result model
│   │   ├── api.ts                      # Generic API response types
│   │   └── index.ts                    # Export all types
│   │
│   ├── api/
│   │   ├── client.ts                   # Centralized HTTP client
│   │   ├── hooks.ts                    # API-calling React hooks (useContacts, useEnrich, etc.)
│   │   ├── endpoints/
│   │   │   ├── contacts.ts             # Contacts API calls
│   │   │   ├── enrichment.ts           # Enrichment API calls
│   │   │   ├── scoring.ts              # Scoring API calls
│   │   │   ├── analytics.ts            # Analytics API calls
│   │   │   └── auth.ts                 # Auth API calls (login, logout, profile)
│   │   └── errors.ts                   # Error handling utilities
│   │
│   ├── components/
│   │   ├── ui/                         # Design system components
│   │   │   ├── Button.tsx              # Button variants (primary, secondary, outline)
│   │   │   ├── Card.tsx                # Card container
│   │   │   ├── Badge.tsx               # Status badges (hot, warm, cold)
│   │   │   ├── Input.tsx               # Text input with validation
│   │   │   ├── Select.tsx              # Dropdown select
│   │   │   ├── Modal.tsx               # Dialog/modal
│   │   │   ├── Tabs.tsx                # Tabbed interface
│   │   │   ├── Tooltip.tsx             # Hover tooltips
│   │   │   ├── Spinner.tsx             # Loading spinner
│   │   │   ├── Alert.tsx               # Alert/toast notification
│   │   │   ├── Table.tsx               # Data table with sorting/pagination
│   │   │   ├── Avatar.tsx              # User avatar
│   │   │   ├── Divider.tsx             # Visual divider
│   │   │   └── Icon.tsx                # Icon wrapper (Lucide React)
│   │   │
│   │   ├── layout/
│   │   │   ├── AppShell.tsx            # Main layout wrapper
│   │   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   │   ├── Header.tsx              # Top header bar
│   │   │   ├── MainContent.tsx         # Main content area
│   │   │   └── Footer.tsx              # Footer (if needed)
│   │   │
│   │   ├── features/
│   │   │   ├── contacts/
│   │   │   │   ├── ContactList.tsx     # Table of contacts with filtering
│   │   │   │   ├── ContactRow.tsx      # Single contact table row
│   │   │   │   ├── ContactFilters.tsx  # Filter UI (search, vertical, status)
│   │   │   │   ├── BulkActions.tsx     # Bulk enrich, rescore buttons
│   │   │   │   └── ImportModal.tsx     # CSV import dialog
│   │   │   │
│   │   │   ├── detail/
│   │   │   │   ├── ContactDetail.tsx   # Contact detail page
│   │   │   │   ├── OverviewTab.tsx     # Contact info + ICP match
│   │   │   │   ├── EnrichmentTab.tsx   # Enrichment display + resync
│   │   │   │   ├── QualificationTab.tsx # BANT + SPICE tabs
│   │   │   │   ├── ActivityTab.tsx     # Contact history + notes
│   │   │   │   └── EnrichmentWidget.tsx # Inline enrichment trigger
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── Dashboard.tsx       # Main dashboard / landing
│   │   │   │   ├── StatsCard.tsx       # KPI card (Total Leads, Hot, etc.)
│   │   │   │   ├── HotLeadsWidget.tsx  # Hot leads list
│   │   │   │   ├── PipelineWidget.tsx  # Pipeline overview
│   │   │   │   ├── ColdCallQueue.tsx   # Queue for cold calling
│   │   │   │   └── SmartLists.tsx      # Smart list selector
│   │   │   │
│   │   │   ├── scoring/
│   │   │   │   ├── APEXScore.tsx       # APEX score card
│   │   │   │   ├── BANTQualifier.tsx   # BANT qualification UI
│   │   │   │   ├── SPICEQualifier.tsx  # SPICE qualification UI
│   │   │   │   ├── UnifiedScore.tsx    # Combined score + recommendation
│   │   │   │   └── ScoreBreakdown.tsx  # Score details + reasoning
│   │   │   │
│   │   │   ├── enrichment/
│   │   │   │   ├── EnrichmentStatus.tsx # Status indicator + progress
│   │   │   │   ├── EnrichmentDisplay.tsx # Sections + content viewer
│   │   │   │   ├── EnrichmentDialog.tsx # Enrich now prompt
│   │   │   │   └── EnrichmentQueue.tsx # Bulk enrichment progress
│   │   │   │
│   │   │   └── analytics/
│   │   │       ├── AnalyticsView.tsx   # Analytics dashboard
│   │   │       ├── PerformanceCard.tsx # Team/rep performance
│   │   │       ├── TrendingChart.tsx   # Simple chart (enrich rate, etc.)
│   │   │       └── ExportButton.tsx    # Export data (CSV, etc.)
│   │   │
│   │   └── common/
│   │       ├── ErrorBoundary.tsx       # Error fallback UI
│   │       ├── LoadingPlaceholder.tsx  # Skeleton loaders
│   │       ├── EmptyState.tsx          # Empty data message
│   │       ├── ConfirmDialog.tsx       # Confirmation prompt
│   │       └── NotFound.tsx            # 404 page
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                  # Auth context hook
│   │   ├── useContacts.ts              # Contacts query hook
│   │   ├── usePagination.ts            # Pagination state
│   │   ├── useSearch.ts                # Search/filter state
│   │   ├── useDebounce.ts              # Debounced value
│   │   ├── useLocalStorage.ts          # LocalStorage persistence
│   │   └── useNotification.ts          # Toast notification system
│   │
│   ├── context/
│   │   ├── AuthContext.tsx             # Auth state (user, token, workspace)
│   │   ├── NotificationContext.tsx     # Toast notifications
│   │   ├── FilterContext.tsx           # Global filter state (vertical, status)
│   │   └── WorkspaceContext.tsx        # Multi-tenant workspace context
│   │
│   ├── utils/
│   │   ├── formatting.ts               # Format currency, dates, scores
│   │   ├── validation.ts               # Form validation helpers
│   │   ├── scoring.ts                  # Score calculation & color mapping
│   │   ├── storage.ts                  # localStorage helpers
│   │   └── file.ts                     # File handling (CSV export, etc.)
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx               # Auth / login form
│   │   ├── DashboardPage.tsx           # Dashboard route
│   │   ├── ContactsPage.tsx            # Contacts list page
│   │   ├── ContactDetailPage.tsx       # Single contact detail page
│   │   ├── AnalyticsPage.tsx           # Analytics view
│   │   ├── SettingsPage.tsx            # Settings & preferences
│   │   └── NotFoundPage.tsx            # 404 fallback
│   │
│   └── styles/
│       ├── globals.css                 # Global styles
│       ├── animations.css              # Custom animations
│       └── utilities.css               # Custom utility classes
│
├── public/
│   ├── favicon.svg
│   └── robots.txt
│
├── package.json
├── README.md
└── .env.example

```

---

## KEY DESIGN DECISIONS DOCUMENTED

### 1. **State Management Choice: Context API → Zustand**

**Decision**: Start with Context API (minimal deps), upgrade to Zustand when complexity grows

**Why**: 
- Context API is sufficient for MVP (contacts, auth, filters)
- Zustand is a drop-in replacement if performance issues arise
- Avoids Redux boilerplate for now

**When to upgrade**:
- If you have >5 context providers with overlapping state
- If you need time-travel debugging (Redux DevTools)
- If performance metrics show re-renders > 500ms

### 2. **API Layer: Custom Fetch vs. React Query**

**Decision**: Start with custom hook layer (useContacts, useEnrich), add React Query wrapper later

**Why**:
- No dependency on React Query for MVP
- Custom hooks teach you the caching/retry patterns
- Easy to migrate to React Query (`useQuery`, `useMutation`) without UI changes

**Transition path**:
```typescript
// MVP: custom hook
const useContacts = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  // manual fetch + error handling
  return { data, loading, error };
};

// Later: React Query drop-in
const useContacts = () => {
  return useQuery(['contacts'], fetchContacts, {
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 2,
  });
};
// Component code unchanged!
```

### 3. **Theming: Dark First, Light Optional**

**Decision**: Dark theme as default, light theme via CSS variable override

**Why**:
- LatticeIQ visual identity is dark/sleek
- Light theme for accessibility/WCAG compliance
- Runtime toggle via `document.documentElement.classList.toggle('light-mode')`

### 4. **Component Library: Headless + Tailwind**

**Decision**: Build custom components (Button, Card, Table) instead of shadcn/ui

**Why**:
- Full design control (no component prop drilling)
- Smaller bundle (no extra dependencies)
- Faster to customize for brand alignment

**If you prefer shadcn/ui later**: All component props map directly (use `className` prop)

### 5. **Type Safety: Strict TypeScript**

**Decision**: `strict: true` + no `any` types

**Why**:
- Catches bugs at compile time
- Self-documenting API contracts
- Easier refactoring across 30+ components

**Enforcement**:
- ESLint rule: `@typescript-eslint/no-explicit-any`
- Git hook: `tsc --noEmit` before commit

### 6. **Enrichment UX: Polling → Server-Sent Events (Future)**

**Decision**: MVP uses polling (GET `/enrichment-status` every 3s), Phase 2 adds SSE

**Why**:
- Polling is simpler (works with any backend)
- SSE requires infrastructure (connection pooling)
- Polling is "good enough" for <1000 concurrent enrichments

**Implementation**:
```typescript
// MVP
useEffect(() => {
  if (status === 'enriching') {
    const interval = setInterval(() => {
      checkEnrichmentStatus(contactId);
    }, 3000);
    return () => clearInterval(interval);
  }
}, [status]);

// Phase 2: SSE
const eventSource = new EventSource(`/api/contacts/${id}/enrichment-stream`);
eventSource.onmessage = (e) => {
  const status = JSON.parse(e.data);
  if (status.completed) eventSource.close();
};
```

### 7. **Multi-Tenancy: Workspace Context**

**Decision**: Workspace ID in JWT + Context API, injected into all API calls

**Why**:
- Prevents accidental cross-workspace data leaks
- Supports future team-based permissions
- Minimal overhead (one header on all requests)

**Implementation**:
```typescript
// AuthContext provides workspace_id
const { workspace_id } = useAuth();

// All API calls include workspace_id
const fetchContacts = () =>
  apiClient.get(`/api/v2/contacts`, {
    headers: { 'X-Workspace-ID': workspace_id },
  });
```

### 8. **Mobile Responsiveness: Mobile-First**

**Decision**: Design for mobile (320px) first, then tablet (768px), then desktop (1024px)

**Why**:
- Sales reps use phones in field
- Mobile-first CSS is smaller
- Better performance on slower devices

**Breakpoints** (from Tailwind):
```
sm: 640px   (tablet)
md: 768px   (large tablet)
lg: 1024px  (desktop)
xl: 1280px  (large desktop)
```

---

## TAILWIND CONFIG EXTENDED

```typescript
// tailwind.config.ts

export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Support light/dark toggle
  theme: {
    extend: {
      colors: {
        // Primary (Cyan/Teal)
        primary: {
          50: '#e1f8ff',
          100: '#b3ecff',
          200: '#80e0ff',
          300: '#4dd4ff', // Primary
          400: '#00d4ff', // Primary main
          500: '#0099cc', // Primary dark
          600: '#007ab3',
          700: '#005c8c',
          800: '#003f66',
          900: '#001f33',
        },
        // Accent (Orange)
        accent: {
          50: '#fff4e6',
          100: '#ffe0b3',
          200: '#ffcc80',
          300: '#ffb800', // Warm
          400: '#ff8c42', // Accent light
          500: '#ff6b35', // Accent
          600: '#e55a2b',
          700: '#cc4922',
          800: '#b23818',
          900: '#99270f',
        },
        // Status colors
        success: '#00ff88',
        success_dark: '#00cc6f',
        warning: '#ffb800',
        warning_dark: '#ff9500',
        error: '#ff4757',
        error_dark: '#ee3c52',
        
        // Neutral (Dark)
        neutral: {
          50: '#f5f7ff',
          100: '#e0e5ff',
          200: '#c2ceff',
          300: '#a0aacc',
          400: '#7a8599',
          500: '#6b7a99', // Text muted
          600: '#4a5266', // Text disabled
          700: '#2f3a5e', // Hover
          800: '#252d4a', // Tertiary bg
          850: '#1a1f3a', // Secondary bg
          900: '#0a0e27', // Primary bg
        },
      },
      
      backgroundColor: {
        primary: '#0a0e27',
        secondary: '#1a1f3a',
        tertiary: '#252d4a',
        hover: '#2f3a5e',
        active: 'rgba(0, 212, 255, 0.08)',
      },
      
      textColor: {
        primary: '#f0f4ff',
        secondary: '#a0aacc',
        tertiary: '#7a8599',
        muted: '#6b7a99',
        disabled: '#4a5266',
      },
      
      borderColor: {
        primary: 'rgba(0, 212, 255, 0.1)',
        light: 'rgba(255, 255, 255, 0.05)',
        lighter: 'rgba(255, 255, 255, 0.02)',
        accent: 'rgba(255, 107, 53, 0.1)',
      },
      
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '40px',
        '10': '48px',
      },
      
      borderRadius: {
        'sm': '6px',
        'base': '12px',
        'lg': '16px',
        'xl': '20px',
        'full': '9999px',
      },
      
      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'sm': '0 2px 4px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 12px rgba(0, 0, 0, 0.15)',
        'lg': '0 12px 24px rgba(0, 0, 0, 0.2)',
        'xl': '0 20px 40px rgba(0, 0, 0, 0.25)',
        'primary': '0 0 20px rgba(0, 212, 255, 0.3)',
        'accent': '0 0 20px rgba(255, 107, 53, 0.3)',
        'success': '0 0 20px rgba(0, 255, 136, 0.3)',
      },
      
      animation: {
        'pulse-primary': 'pulse-primary 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
      },
      
      keyframes: {
        'pulse-primary': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 212, 255, 0.7)' },
          '50%': { boxShadow: '0 0 0 10px rgba(0, 212, 255, 0)' },
        },
        'slideIn': {
          'from': { transform: 'translateY(-10px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
        'fadeIn': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
      },
      
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '350ms',
      },
      
      transitionTimingFunction: {
        'easing': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  
  plugins: [],
};
```

---

## MIGRATION PLAN (From HTML Dashboard to React/Tailwind)

### Phase 1: Component Library (Week 1)
- [ ] Create 15 UI components (Button, Card, Badge, Table, Tabs, Modal, etc.)
- [ ] Storybook for isolated component development
- [ ] Unit tests for each component

### Phase 2: Layout & Navigation (Week 2)
- [ ] AppShell (Sidebar + Header + Main)
- [ ] Router setup (React Router v6)
- [ ] Auth context + login flow
- [ ] Page-level layouts

### Phase 3: Feature Pages (Weeks 3–4)
- [ ] Dashboard (stats cards, hot leads, pipeline)
- [ ] Contacts list (table, filtering, bulk actions)
- [ ] Contact detail (tabs, scoring, enrichment)

### Phase 4: API Integration (Week 5)
- [ ] API client layer
- [ ] Custom hooks (useContacts, useEnrich, etc.)
- [ ] Error handling & retry logic
- [ ] Loading & empty states

### Phase 5: Polish & Testing (Week 6)
- [ ] Responsive design fixes
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] E2E tests (Playwright)
- [ ] Performance optimization

---

## DEPLOYMENT CHECKLIST

**Before Production**:
- [ ] Environment variables configured (.env.production)
- [ ] API base URL points to production backend
- [ ] Auth token refresh logic works
- [ ] Build optimized (`npm run build` < 1MB)
- [ ] Security headers added (CORS, CSP, X-Frame-Options)
- [ ] Error tracking (Sentry) integrated
- [ ] Analytics (Mixpanel) integrated
- [ ] PWA service worker (optional for offline support)
- [ ] SSL certificate configured
- [ ] DNS/CDN (Vercel, Netlify) configured
- [ ] Load testing passed (>100 concurrent users)

---

## ASSUMPTIONS SUMMARY

| Assumption | Impact | Mitigation |
|-----------|--------|-----------|
| Backend APIs stable | High | Version endpoints, add deprecation warnings |
| JWT auth in Authorization header | High | Support Bearer token scheme, refresh token handling |
| Workspace ID in JWT claims | Medium | Add to token on backend, provide in AuthContext |
| Enrichment is async | High | Polling or WebSocket required for UX |
| All contacts fit in memory | Medium | Add pagination, lazy-load rows |
| Vertical/ICP data in contact schema | Medium | Fallback to user profile defaults |
| No real-time collab (multi-edit) | Medium | Implement optimistic locking (version field) |
| Mobile = touch-friendly, no hover | Medium | Add focus states for keyboard + touch |

---

## NEXT STEPS

1. **Setup**: Clone template, run `npm install`, start `npm run dev`
2. **Customize Tailwind**: Adjust colors/spacing to brand guidelines
3. **Build Components**: Start with Button, Card, Table (most used)
4. **Connect API**: Implement useContacts hook, fetch real data
5. **Deploy**: Push to Vercel/Netlify, add CI/CD (GitHub Actions)
6. **Monitor**: Add Sentry + analytics, track user flows
7. **Iterate**: Gather feedback, refactor, optimize

---

**End of Frontend Roadmap**

This document provides your team with a clear blueprint for building LatticeIQ's React/Tailwind frontend while preserving the powerful backend logic from Apex. Good luck! 🚀
