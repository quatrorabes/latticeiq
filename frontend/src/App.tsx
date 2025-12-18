import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

interface Contact {
  id: number
  first_name: string
  last_name: string
  email: string
  company: string
  title: string
  apex_score: number
}

function Auth({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else onLogin()
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else onLogin()
    }
  }

  return (
    <div className="auth-container">
      <h1>LatticeIQ</h1>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">{isSignUp ? 'Sign Up' : 'Log In'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p onClick={() => setIsSignUp(!isSignUp)} className="toggle">
        {isSignUp ? 'Have an account? Log in' : 'Need an account? Sign up'}
      </p>
    </div>
  )
}

function Dashboard({ token, onLogout }: { token: string, onLogout: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/contacts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => { setContacts(data.contacts || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="dashboard">
      <header>
        <h1>LatticeIQ</h1>
        <button onClick={onLogout}>Log Out</button>
      </header>
      <h2>Your Contacts ({contacts.length})</h2>
      {contacts.length === 0 ? (
        <p>No contacts yet. Add your first contact to get started.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Company</th><th>Title</th><th>Email</th><th>Score</th></tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td>{c.first_name} {c.last_name}</td>
                <td>{c.company}</td>
                <td>{c.title}</td>
                <td>{c.email}</td>
                <td>{c.apex_score || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  if (loading) return <div className="loading">Loading...</div>

  return session ? (
    <Dashboard token={session.access_token} onLogout={() => supabase.auth.signOut()} />
  ) : (
    <Auth onLogin={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} />
  )
}
