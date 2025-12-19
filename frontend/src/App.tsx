// frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Contacts from './pages/Contacts';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import Loader from './components/Loader';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, currentSession: Session | null) => {
        setSession(currentSession);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
        <div className="min-h-screen bg-gray-950">
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
      <div className="min-h-screen bg-gray-950 flex">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/contacts" replace />} />
            <Route path="/contacts" element={<Contacts onLogout={handleLogout} />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/contacts" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
