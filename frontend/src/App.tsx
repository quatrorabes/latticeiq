import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ContactsTable } from './components/ContactsTable';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Contact {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  title?: string;
  apex_score?: number;
  enrichment_status?: string;
  enrichment_data?: any;
}

function Auth({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
    else onLogin();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-96">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">LatticeIQ</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-purple-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-2 rounded font-semibold hover:bg-purple-700"
          >
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>
        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
        <p className="text-gray-400 text-center mt-4 cursor-pointer" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Have an account? Log in' : "Need an account? Sign up"}
        </p>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">LatticeIQ</h1>
        <button
          onClick={onLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-semibold"
        >
          Log Out
        </button>
      </div>
      <ContactsTable />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );

  return session ? (
    <Dashboard token={session.access_token} onLogout={() => supabase.auth.signOut()} />
  ) : (
    <Auth onLogin={() => supabase.auth.getSession().then(({ data: { session } }) => setSession(session))} />
  );
}
