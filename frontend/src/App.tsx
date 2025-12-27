import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ContactsPage from './pages/ContactsPage';
import ContactDetailPage from './pages/ContactDetailPage';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({  { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {  { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white">Loading...</p>
    </div>;
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
        <main className="flex-1 ml-64">
          <Routes>
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:contactId" element={<ContactDetailPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/contacts" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
