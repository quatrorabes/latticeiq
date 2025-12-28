import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ContactsPage from './pages/ContactsPage';
import ImportPage from './pages/ImportPage';
import SettingsPage from './pages/SettingsPage';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import ScoringPage from './pages/ScoringPage';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then((data: any) => {
      setSession(data.session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0e27', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'white' }}>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Router>
        <div style={{ minHeight: '100vh', background: '#0a0e27' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    );
  }

  return (
    <Router>
      <div style={{ minHeight: '100vh', background: '#0a0e27', display: 'flex' }}>
        <Sidebar onLogout={handleLogout} />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scoring" element={<ScoringPage />} />
            <Route path="*" element={<Navigate to="/contacts" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;