import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'

// Pages
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ContactsPage from './pages/ContactsPage'
import EnrichmentPage from './pages/EnrichmentPage'
import ScoringPage from './pages/ScoringPage'
import SettingsPage from './pages/SettingsPage'
import CRMPage from './pages/CRMPage'
import PremiumDashboard from './pages/PremiumDashboard';
import ContactDetailsExpanded from './pages/ContactDetailsExpanded';
export default function App() {
  const { session, loading } = useAuth()
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') !== 'false'
    }
    return true
  })

  useEffect(() => {
    const html = document.documentElement
    if (darkMode) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    localStorage.setItem('darkMode', darkMode.toString())
  }, [darkMode])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        {!session ? (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route
            element={
              <Layout
                darkMode={darkMode}
                onToggleDarkMode={() => setDarkMode(!darkMode)}
              />
            }
          >
            <Route path="/" element={<Navigate to="/contacts" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/enrichment" element={<EnrichmentPage />} />
            <Route path="/scoring" element={<ScoringPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/crm" element={<CRMPage />} />
            <Route path="*" element={<Navigate to="/contacts" replace />} />
            <Route path="/premium/dashboard" element={<PremiumDashboard />} />
            <Route path="/contacts" element={<ContactsPage />} />
          </Route>
        )}
      </Routes>
    </Router>
  )
}