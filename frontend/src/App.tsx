import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ContactsPage from "./pages/ContactsPage";
import LeadScoring from "./pages/LeadScoring";
import Enrichment from "./pages/Enrichment";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Sidebar from "./components/Sidebar";
import "./App.css";

// Initialize Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // ✅ SAVE TOKEN TO LOCALSTORAGE
      if (session?.access_token) {
        localStorage.setItem("sb-auth-token", session.access_token);
      }
      setLoading(false);
    });

    // ✅ LISTEN FOR AUTH CHANGES
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      // Save token when user logs in
      if (event === "SIGNED_IN" && session?.access_token) {
        localStorage.setItem("sb-auth-token", session.access_token);
      }
      
      // Clear token when user logs out
      if (event === "SIGNED_OUT") {
        localStorage.removeItem("sb-auth-token");
      }
      
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-600 text-lg">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/lead-scoring" element={<LeadScoring />} />
            <Route path="/enrichment" element={<Enrichment />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
