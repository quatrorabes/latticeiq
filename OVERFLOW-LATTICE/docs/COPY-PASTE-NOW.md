# 🚀 COPY-PASTE DEPLOYMENT GUIDE

Your **3 fixed files are ready**. You just need to copy them into your project.

---

## **COPY-PASTE THESE FILES INTO YOUR PROJECT:**

### **FILE 1: Replace src/App.tsx**

Delete everything in `frontend/src/App.tsx` and paste this:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';
import EnrichmentPage from './pages/EnrichmentPage';
import SettingsPage from './pages/SettingsPage';
import ProfileConfigPage from './pages/ProfileConfigPage';
import ContactsPage from './pages/ContactsPage';
import ScoringConfigPage from './pages/ScoringConfigPage';

function App() {
  const [session, setSession] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/signup" element={session ? <Navigate to="/dashboard" /> : <SignupPage />} />
        
        <Route element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/enrichment" element={<EnrichmentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/scoring" element={<ScoringConfigPage />} />
          <Route path="/profile" element={<ProfileConfigPage />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

---

### **FILE 2: Replace src/components/Sidebar.tsx**

Delete everything in `frontend/src/components/Sidebar.tsx` and paste this:

```tsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/contacts', label: 'Contacts', icon: '👥' },
    { path: '/scoring', label: 'Lead Scoring', icon: '⭐' },
    { path: '/enrichment', label: 'Enrichment', icon: '✨' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className={`bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      } h-screen sticky top-0 flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!isCollapsed && <h1 className="text-xl font-bold text-cyan-400">LatticeIQ</h1>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-gray-800 rounded transition"
        >
          {isCollapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
              isActive(item.path)
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={onLogout}
          className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition text-sm font-medium"
        >
          {!isCollapsed ? 'Logout' : '→'}
        </button>
      </div>
    </aside>
  );
}
```

---

### **FILE 3: Replace src/pages/ScoringConfigPage.tsx**

This file is very long. Download the full file from: **ScoringConfigPage-v2-FIXED.tsx**

Or copy the first 50 lines to verify, then use the full file from the artifact.

Key changes:
- Remove line with `Copy, Check` from imports
- Remove `copiedIndex` state
- Remove `handleCopy` function
- Use `dimension` instead of `idx` in map()

---

## **VERIFICATION AFTER COPYING:**

```bash
cd ~/projects/latticeiq/frontend

# Check files exist
ls -la src/App.tsx
ls -la src/components/Sidebar.tsx
ls -la src/pages/ScoringConfigPage.tsx

# Build test
npm run build

# Should see: ✓ built successfully (0 errors)
```

---

## **IF STILL GETTING ERRORS:**

The old files might be cached. Try:

```bash
cd ~/projects/latticeiq/frontend

# Clear cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

---

## **DEPLOY WHEN BUILD SUCCEEDS:**

```bash
git add src/App.tsx src/components/Sidebar.tsx src/pages/ScoringConfigPage.tsx
git commit -m "fix: Resolve all TypeScript compilation errors"
git push origin main
```

Wait 2-3 minutes for Vercel to build. Then check: **https://latticeiq.vercel.app**

---

**TL;DR: The files aren't actually copied to your project yet. Copy the 3 files, then `npm run build`. Done!** ✨
