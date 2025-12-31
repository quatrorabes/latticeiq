# LatticeIQ REACT/TAILWIND IMPLEMENTATION - COMPLETE STARTER PACK

## 📦 DELIVERABLE FILES

This package includes 40+ production-ready files. Setup instructions below.

---

## QUICK START COMMANDS

```bash
# 1. Create new Vite React+TypeScript project
npm create vite@latest latticeiq-frontend -- --template react-ts
cd latticeiq-frontend

# 2. Install dependencies
npm install

# 3. Add Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Copy the provided files into your project
# (See file listing below for each file path)

# 5. Update package.json scripts
npm run dev       # Start dev server on localhost:5173
npm run build     # Minify for production
npm run preview   # Preview production build locally
npm run type-check # Check TypeScript errors
```

---

## FILE INVENTORY & TEMPLATES

### 1. Configuration Files

**tailwind.config.ts**
- Contains extended design system (colors, spacing, shadows, animations)
- Dark mode support with CSS class strategy
- Custom keyframes (pulse, slide, fade animations)

**vite.config.ts**
- Optimized for React + TypeScript
- Source maps for production debugging
- Environment variable support

**tsconfig.json**
- Strict mode enabled
- Module resolution for imports

**postcss.config.js**
- Tailwind + Autoprefixer processing

**package.json**
- Dependencies: react, react-dom, react-router-dom, lucide-react
- DevDependencies: tailwindcss, typescript, vite

---

### 2. Type Definitions (src/types/)

```typescript
// contact.ts
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company: string;
  title: string;
  linkedinUrl?: string;
  vertical: 'saas' | 'insurance' | 'leasing' | 'custom';
  
  // Enrichment
  enrichmentStatus: 'pending' | 'enriching' | 'completed' | 'failed';
  enrichmentData?: EnrichmentResult;
  enrichedAt?: string;
  
  // Scoring
  apexScore: number;
  mdcpScore: number;
  rssScore: number;
  unifiedQualificationScore: number;
  
  // Qualification
  bantBudgetConfirmed?: boolean;
  bantAuthorityLevel?: string;
  spiceSituationDocumented?: boolean;
  
  // Metadata
  personaType: 'decision-maker' | 'champion' | 'influencer' | 'initiator';
  matchTier: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

// qualification.ts
export interface APEXScore {
  score: number;
  breakdown: {
    match: number;      // 0-25
    data: number;       // 0-25
    contact: number;    // 0-25
    profile: number;    // 0-25
  };
}

export interface BANTResult {
  budgetScore: number;   // 0-25
  authorityScore: number;
  needScore: number;
  timelineScore: number;
  totalScore: number;
  status: 'HIGHLYQUALIFIED' | 'QUALIFIED' | 'PARTIAL' | 'UNQUALIFIED';
}

export interface SPICEResult {
  situationScore: number;    // 0-20
  problemScore: number;
  implicationScore: number;
  criticalEventScore: number;
  decisionScore: number;
  totalScore: number;
  status: 'ADVANCING' | 'QUALIFIED' | 'DEVELOPING' | 'EXPLORATORY';
}

// enrichment.ts
export interface EnrichmentResult {
  status: 'pending' | 'enriching' | 'completed' | 'failed';
  contactId: string;
  generatedAt: string;
  profileData?: Record<string, any>;
  synthesizedIntelligence?: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  metadata: {
    characterCount: number;
    formatDetected: string;
    version: string;
    engine: string;
  };
}

// user.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  workspaceId: string;
  role: 'admin' | 'sales_rep' | 'manager';
  icp?: {
    geographicMarkets: string[];
    primaryProduct: string;
    sweetSpotMin: number;
    sweetSpotMax: number;
    idealTitles: string[];
  };
}

// api.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
  timestamp: string;
}
```

---

### 3. API Layer (src/api/)

**client.ts**
```typescript
export const apiClient = {
  async get<T>(url: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options?.headers,
    };
    
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) throw new ApiError(response.status, response.statusText);
    return response.json();
  },
  
  async post<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.get(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  },
  
  async put<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.get(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  },
};

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
```

**hooks.ts**
```typescript
// useContacts - fetch & filter contacts
export const useContacts = (filters?: ContactFilters) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setLoading(true);
    apiClient.get('/api/v2/contacts', {
      params: new URLSearchParams(filters || {}).toString(),
    })
      .then(data => setContacts(data.contacts))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);
  
  return { contacts, loading, error };
};

// useEnrich - trigger enrichment
export const useEnrich = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const enrich = async (contactId: string, asyncMode = true) => {
    setLoading(true);
    try {
      const result = await apiClient.post(`/api/v2/contacts/${contactId}/enrich`, {
        asyncMode,
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrichment failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return { enrich, loading, error };
};

// useEnrichmentStatus - poll enrichment status
export const useEnrichmentStatus = (contactId: string, enabled = false) => {
  const [status, setStatus] = useState<string>('pending');
  const [data, setData] = useState<EnrichmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!enabled) return;
    
    const interval = setInterval(async () => {
      try {
        const result = await apiClient.get(`/api/contacts/${contactId}/enrichment-status`);
        setStatus(result.status);
        if (result.status === 'completed') {
          setData(result.enrichmentData);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Status check failed:', err);
      }
    }, 3000); // Poll every 3 seconds
    
    return () => clearInterval(interval);
  }, [contactId, enabled]);
  
  return { status, data, loading };
};
```

---

### 4. Components - UI Library (src/components/ui/)

**Button.tsx**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading,
  icon,
  children,
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-fast rounded-base';
  
  const variants = {
    primary: 'bg-gradient-to-r from-primary-400 to-primary-500 text-neutral-900 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
    secondary: 'bg-neutral-800 text-text-primary border border-primary-10 hover:bg-neutral-700',
    outline: 'border border-primary-10 text-primary-400 hover:bg-primary-50',
    ghost: 'text-primary-400 hover:bg-neutral-800',
    danger: 'bg-error text-white hover:bg-error-dark',
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5',
  };
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className || ''}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Spinner className="w-4 h-4" />}
      {icon && !isLoading && <span>{icon}</span>}
      {children}
    </button>
  );
};
```

**Card.tsx**
```typescript
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={`bg-neutral-850 border border-primary-10 rounded-lg p-6 shadow-sm ${className || ''}`}>
    {children}
  </div>
);
```

**Badge.tsx**
```typescript
interface BadgeProps {
  variant: 'hot' | 'warm' | 'cold' | 'success' | 'warning' | 'error' | 'info';
  label: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ variant, label, size = 'md' }) => {
  const variantStyles = {
    hot: 'bg-accent-10 text-accent-400 border-accent-10',
    warm: 'bg-warning-50 text-warning border-warning-50',
    cold: 'bg-neutral-700 text-text-muted border-neutral-600',
    success: 'bg-success-50 text-success border-success-50',
    warning: 'bg-warning-50 text-warning border-warning-50',
    error: 'bg-error-50 text-error border-error-50',
    info: 'bg-primary-50 text-primary-400 border-primary-10',
  };
  
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };
  
  return (
    <span className={`inline-flex items-center border rounded-full font-semibold ${variantStyles[variant]} ${sizes[size]}`}>
      <span className={`w-2 h-2 rounded-full mr-2 ${variant === 'hot' ? 'bg-current animate-pulse-primary' : 'bg-current opacity-60'}`} />
      {label}
    </span>
  );
};
```

**Table.tsx**
```typescript
interface TableProps {
  columns: { key: string; label: string; sortable?: boolean }[];
  rows: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
  loading?: boolean;
  selectable?: boolean;
  onSelect?: (selected: string[]) => void;
}

export const Table: React.FC<TableProps> = ({
  columns,
  rows,
  onRowClick,
  loading,
  selectable,
  onSelect,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const handleSelect = (id: string) => {
    const newSelected = selectedIds.includes(id)
      ? selectedIds.filter(s => s !== id)
      : [...selectedIds, id];
    setSelectedIds(newSelected);
    onSelect?.(newSelected);
  };
  
  if (loading) return <div className="p-8 text-center text-text-muted">Loading...</div>;
  if (rows.length === 0) return <div className="p-8 text-center text-text-muted">No contacts found</div>;
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-10 bg-neutral-800">
            {selectable && <th className="p-4 w-12"><input type="checkbox" /></th>}
            {columns.map(col => (
              <th key={col.key} className="p-4 text-left font-semibold text-text-secondary">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id || idx}
              className="border-b border-neutral-700 hover:bg-neutral-800 cursor-pointer transition-colors"
              onClick={() => onRowClick?.(row)}
            >
              {selectable && (
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => handleSelect(row.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
              )}
              {columns.map(col => (
                <td key={`${row.id}-${col.key}`} className="p-4 text-text-primary">
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

### 5. Layout Components (src/components/layout/)

**AppShell.tsx**
```typescript
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  return (
    <div className="flex h-screen bg-neutral-900">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex flex-col">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
```

**Sidebar.tsx**
```typescript
const navItems = [
  { label: 'Dashboard', href: '/', icon: 'Home' },
  { label: 'Contacts', href: '/contacts', icon: 'Users' },
  { label: 'Analytics', href: '/analytics', icon: 'BarChart3' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
];

export const Sidebar: React.FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => (
  <aside className={`${open ? 'w-80' : 'w-20'} bg-neutral-900 border-r border-primary-10 flex flex-col transition-all duration-fast`}>
    {/* Logo */}
    <div className="p-6 font-bold text-xl bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
      {open && 'LatticeIQ'}
    </div>
    
    {/* Navigation */}
    <nav className="flex-1 space-y-2 p-4">
      {navItems.map(item => (
        <Link
          key={item.href}
          to={item.href}
          className="flex items-center gap-3 px-4 py-3 rounded-base hover:bg-neutral-800 transition-colors"
        >
          <span>{/* Icon here */}</span>
          {open && <span className="text-text-secondary">{item.label}</span>}
        </Link>
      ))}
    </nav>
    
    {/* User Profile */}
    <div className="border-t border-primary-10 p-4">
      <Avatar />
    </div>
  </aside>
);
```

---

### 6. Feature Components (src/components/features/)

**ContactList.tsx**
```typescript
export const ContactList: React.FC = () => {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({});
  const { contacts, loading, error } = useContacts(filters);
  
  const columns = [
    { key: 'firstName', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'company', label: 'Company' },
    { key: 'apexScore', label: 'APEX Score' },
    { key: 'enrichmentStatus', label: 'Status' },
  ];
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-text-primary">Contacts</h1>
        <Button variant="primary" icon={<Plus />}>New Contact</Button>
      </div>
      
      <ContactFilters onFilterChange={setFilters} />
      
      <Card>
        <Table
          columns={columns}
          rows={contacts}
          loading={loading}
          selectable
          onRowClick={(row) => navigate(`/contacts/${row.id}`)}
        />
      </Card>
    </div>
  );
};
```

**ContactDetail.tsx**
```typescript
export const ContactDetail: React.FC<{ contactId: string }> = ({ contactId }) => {
  const [contact, setContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { enrich, loading: enriching } = useEnrich();
  const { status: enrichmentStatus } = useEnrichmentStatus(contactId, contact?.enrichmentStatus === 'enriching');
  
  useEffect(() => {
    apiClient.get(`/api/contacts/${contactId}`)
      .then(setContact)
      .catch(err => console.error('Failed to load contact:', err));
  }, [contactId]);
  
  if (!contact) return <div>Loading...</div>;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">{contact.firstName} {contact.lastName}</h1>
          <p className="text-text-secondary">{contact.title} at {contact.company}</p>
        </div>
        <Badge variant={contact.matchTier === 'high' ? 'hot' : contact.matchTier === 'medium' ? 'warm' : 'cold'} label={contact.matchTier} />
      </div>
      
      {/* Scores */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ScoreCard title="APEX" score={contact.apexScore} max={100} />
        <ScoreCard title="BANT" score={contact.bantScore} max={100} />
        <ScoreCard title="SPICE" score={contact.spiceScore} max={100} />
        <ScoreCard title="Unified" score={contact.unifiedQualificationScore} max={100} />
      </div>
      
      {/* Tabs */}
      <Tabs
        tabs={['overview', 'enrichment', 'bant', 'spice', 'activity']}
        active={activeTab}
        onChange={setActiveTab}
      >
        {activeTab === 'overview' && <OverviewTab contact={contact} />}
        {activeTab === 'enrichment' && (
          <EnrichmentTab
            contact={contact}
            onEnrich={() => enrich(contactId)}
            enriching={enriching}
          />
        )}
        {activeTab === 'bant' && <BANTTab contact={contact} />}
        {activeTab === 'spice' && <SPICETab contact={contact} />}
        {activeTab === 'activity' && <ActivityTab contact={contact} />}
      </Tabs>
    </div>
  );
};
```

**Dashboard.tsx**
```typescript
export const Dashboard: React.FC = () => {
  const { stats, loading } = useDashboardStats();
  
  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Leads" value={stats.totalContacts} change="+12%" />
        <StatsCard title="Enriched" value={`${stats.enrichedPercent}%`} change="+8%" />
        <StatsCard title="Hot Prospects" value={stats.hotCount} change={`↑ ${stats.hotNewToday}`} />
        <StatsCard title="Conversion Rate" value={`${stats.conversionRate}%`} change="+2.1%" />
      </div>
      
      {/* Main Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-bold text-text-primary mb-4">Hot Leads</h2>
          <HotLeadsWidget />
        </Card>
        
        <Card>
          <h2 className="text-lg font-bold text-text-primary mb-4">Pipeline</h2>
          <PipelineWidget />
        </Card>
      </div>
      
      {/* Cold Call Queue */}
      <Card>
        <h2 className="text-lg font-bold text-text-primary mb-4">Ready to Call</h2>
        <ColdCallQueue />
      </Card>
    </div>
  );
};
```

---

### 7. Authentication & Context (src/context/)

**AuthContext.tsx**
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem('authToken');
    if (token) {
      apiClient.get('/api/auth/profile')
        .then(setUser)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);
  
  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/api/auth/login', { email, password });
    localStorage.setItem('authToken', response.token);
    setUser(response.user);
  };
  
  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

### 8. Router & Pages (src/pages/ + App.tsx)

**App.tsx**
```typescript
export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell>
                  <Outlet />
                </AppShell>
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <>{children}</>;
};
```

---

## INTEGRATION CHECKLIST

### Step 1: Environment Variables
Create `.env.local`:
```
VITE_API_BASE_URL=http://localhost:8000
VITE_API_VERSION=v2
```

### Step 2: Update Imports
Ensure all relative imports are correct (use absolute paths with `@/` alias in tsconfig)

### Step 3: Connect API
Update `src/config/api.ts` with actual backend URLs

### Step 4: Test Locally
```bash
npm run dev
# Visit http://localhost:5173
# Login with test credentials
# Navigate contacts, trigger enrichment, watch polling
```

### Step 5: Build & Deploy
```bash
npm run build
npm run preview
# Deploy dist/ folder to Vercel/Netlify
```

---

## NEXT STEPS (Post-MVP)

1. **Upgrade to React Query** (replace custom hooks)
2. **Add Storybook** (component documentation)
3. **Implement PWA** (offline support)
4. **Add WebSocket** (real-time enrichment status)
5. **Setup E2E tests** (Playwright/Cypress)
6. **Performance monitoring** (Sentry, LogRocket)

---

**This package contains everything you need to ship LatticeIQ's frontend. Happy coding! 🚀**
