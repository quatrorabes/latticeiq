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
import ContactDetailModal from './components/ContactDetailModal';
import ContactsPage from './pages/ContactsPage';
import ScoringConfigPage from './pages/ScoringConfigPage';

function App() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/contacts" />} />
        <Route path="/signup" element={!session ? <SignupPage /> : <Navigate to="/contacts" />} />
        <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/contacts" />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="enrichment" element={<EnrichmentPage />} />
          <Route path="/scoring" element={<ScoringConfigPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile-config" element={<ProfileConfigPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/contacts" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
