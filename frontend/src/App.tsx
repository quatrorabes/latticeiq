import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Layout from './components/Layout';
import PremiumDashboard from './pages/PremiumDashboard';  // CHANGE THIS LINE
import ContactsPage from './pages/ContactsPage';
import CRMPage from './pages/CRMPage';
import ScoringPage from './pages/ScoringPage';
import SettingsPage from './pages/SettingsPage';
import SmartListsPage from './pages/SmartListsPage';
import PipelinePage from './pages/PipelinePage';
import AIWriterPage from './pages/AIWriterPage';
import IntegrationsPage from './pages/IntegrationsPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ICPsPage from './pages/ICPsPage';
import CampaignsPage from './pages/CampaignsPage';
import TemplatesPage from './pages/TemplatesPage';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f172a',
        color: '#f9fafb'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<PremiumDashboard />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/crm" element={<CRMPage />} />
          <Route path="/smart-lists" element={<SmartListsPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/ai-writer" element={<AIWriterPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/scoring" element={<ScoringPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/icps" element={<ICPsPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
