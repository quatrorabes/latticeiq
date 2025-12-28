import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ContactsPage from "./pages/ContactsPage";
import "./App.css";

// Initialize Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface AuthSession {
  access_token: string;
  user: {
    id: string;
    email: string;
  };
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession({
          access_token: session.access_token,
          user: session.user,
        } as AuthSession);
        // ✅ SAVE TOKEN TO LOCALSTORAGE
        localStorage.setItem("sb-auth-token", session.access_token);
      }
      setLoading(false);
    });

    // ✅ LISTEN FOR AUTH CHANGES
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSession({
          access_token: session.access_token,
          user: session.user,
        } as AuthSession);

        // Save token when user logs in
        if (event === "SIGNED_IN") {
          localStorage.setItem("sb-auth-token", session.access_token);
        }
      } else {
        setSession(null);
        // Clear token when user logs out
        if (event === "SIGNED_OUT") {
          localStorage.removeItem("sb-auth-token");
        }
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

  // If not logged in, show minimal UI with login prompt
  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">LatticeIQ</h1>
          <p className="text-gray-600 mb-6">Please log in via Supabase Auth</p>
          <a
            href="https://latticeiq.vercel.app"
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-8">LatticeIQ</h1>
          <nav className="space-y-4">
            <a
              href="/"
              className="block px-4 py-2 rounded hover:bg-gray-100"
            >
              Dashboard
            </a>
            <a
              href="/contacts"
              className="block px-4 py-2 rounded hover:bg-gray-100"
            >
              Contacts
            </a>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full text-left px-4 py-2 rounded hover:bg-red-50 text-red-600 font-medium mt-8"
            >
              Logout
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
