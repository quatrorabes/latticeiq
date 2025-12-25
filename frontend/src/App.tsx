// frontend/src/App.tsx

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
