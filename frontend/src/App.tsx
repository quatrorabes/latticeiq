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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

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
        localStorage.setItem("sb-refresh-token", session.refresh_token || "");
      }
      setLoading(false);
    });

    // ✅ LISTEN FOR AUTH CHANGES & AUTO-REFRESH
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSession({
          access_token: session.access_token,
          user: session.user,
        } as AuthSession);

        // Always save fresh tokens
        localStorage.setItem("sb-auth-token", session.access_token);
        localStorage.setItem("sb-refresh-token", session.refresh_token || "");

        // Auto-refresh token 5 minutes before expiry
        if (session.expires_at) {
          const expiresIn = session.expires_at * 1000 - Date.now();
          const refreshIn = expiresIn - 5 * 60 * 1000; // 5 min before expiry

          if (refreshIn > 0) {
            setTimeout(() => {
              supabase.auth.refreshSession();
            }, refreshIn);
          }
        }
      } else {
        setSession(null);
        localStorage.removeItem("sb-auth-token");
        localStorage.removeItem("sb-refresh-token");
      }

      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoginError(error.message);
        return;
      }

      if (data?.session?.access_token) {
        localStorage.setItem("sb-auth-token", data.session.access_token);
        localStorage.setItem("sb-refresh-token", data.session.refresh_token || "");
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setLoginError(error.message);
        return;
      }

      if (data?.user) {
        setLoginError("Check your email for a confirmation link!");
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign up failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-600 text-lg">Loading...</p>
      </div>
    );
  }

  // Login Page
  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow p-8">
            <h1 className="text-3xl font-bold mb-2 text-center">LatticeIQ</h1>
            <p className="text-gray-600 text-center mb-6">
              Sales Intelligence Platform
            </p>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
              >
                Sign In
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600 mb-3">
                Don't have an account?
              </p>
              <button
                onClick={handleSignUp}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in App
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
