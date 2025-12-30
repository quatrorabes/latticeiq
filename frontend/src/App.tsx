// frontend/src/App.tsx

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { supabase } from './lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ContactsPage from './pages/ContactsPage';
import ScoringConfigPage from './pages/ScoringConfigPage';
import SettingsPage from './pages/SettingsPage';

// Components
import Sidebar from './components/Sidebar';
import Loader from './components/Loader';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!session) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar onLogout={handleLogout} />

        <main className="ml-64 flex-1 p-8">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/scoring-config" element={<ScoringConfigPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {/* ✅ Portal container for modals - renders at document.body */}
      {createPortal(
        <div id="modal-root" />,
        document.body
      )}
    </Router>
  );
}

export default App;
