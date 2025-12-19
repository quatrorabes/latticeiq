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
  enrichment_status: string
  enrichment_data?: any
}

function Auth({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else onLogin()
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
        {isSignUp ? 'Have an account? Log in' : "Need an account? Sign up"}
      </p>
    </div>
  )
}

function ContactProfile({ contact, onClose }: { contact: Contact, onClose: () => void }) {
  const profile = contact.enrichment_data?.synthesized || {}
  
  return (
    <div className="modal-overlay">
      <div className="modal profile-modal">
        <div className="modal-header">
          <h2>{contact.first_name} {contact.last_name}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="profile-content">
          <div className="profile-header">
            <p><strong>{contact.title}</strong> at <strong>{contact.company}</strong></p>
            <div className="score-badge">APEX: {contact.apex_score || '-'}</div>
          </div>

          {profile.profile_summary && (
            <section>
              <h3>Summary</h3>
              <p>{profile.profile_summary}</p>
            </section>
          )}

          {profile.opening_line && (
            <section>
              <h3>🎯 Opening Line</h3>
              <p className="highlight">{profile.opening_line}</p>
            </section>
          )}

          {profile.hook_angle && (
            <section>
              <h3>🪝 Best Hook</h3>
              <p>{profile.hook_angle}</p>
            </section>
          )}

          {profile.why_buy_now && (
            <section>
              <h3>⏰ Why Now?</h3>
              <p>{profile.why_buy_now}</p>
            </section>
          )}

          {profile.talking_points?.length > 0 && (
            <section>
              <h3>💬 Talking Points</h3>
              <ul>
                {profile.talking_points.map((p: string, i: number) => <li key={i}>{p}</li>)}
              </ul>
            </section>
          )}

          {profile.likely_objections?.length > 0 && (
            <section>
              <h3>🛡️ Objection Handlers</h3>
              {profile.likely_objections.map((obj: string, i: number) => (
                <div key={i} className="objection">
                  <p><strong>"{obj}"</strong></p>
                  <p className="handler">→ {profile.objection_handlers?.[obj] || 'Handle with care'}</p>
                </div>
              ))}
            </section>
          )}

          <section className="scores">
            <h3>BANT Scores</h3>
            <div className="score-grid">
              <div>Budget: {profile.bant_budget || '-'}/10</div>
              <div>Authority: {profile.bant_authority || '-'}/10</div>
              <div>Need: {profile.bant_need || '-'}/10</div>
              <div>Timing: {profile.bant_timing || '-'}/10</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ token, onLogout }: { token: string, onLogout: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState<number | null>(null)
  const [batchEnriching, setBatchEnriching] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showImport, setShowImport] = useState(false)

  const fetchContacts = () => {
    fetch(`${API_URL}/api/contacts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setContacts(data.contacts || [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchContacts() }, [token])

  const enrichContact = async (contactId: number) => {
    setEnriching(contactId)
    try {
      const response = await fetch(`${API_URL}/api/v3/enrichment/enrich`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contact_id: contactId, synthesize: true })
      })
      const data = await response.json()
      if (data.success) {
        fetchContacts()
      } else {
        alert('Enrichment failed: ' + (data.detail || 'Unknown error'))
      }
    } catch (err: any) {
      alert('Enrichment error: ' + err.message)
    }
    setEnriching(null)
  }

  const enrichBatch = async () => {
    setBatchEnriching(true)
    try {
      const response = await fetch(`${API_URL}/api/v3/enrichment/enrich/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 10, synthesize: true })
      })
      const data = await response.json()
      if (data.success) {
        alert(`Enriched ${data.enriched} contacts, ${data.failed} failed`)
        fetchContacts()
      }
    } catch (err: any) {
      alert('Batch enrichment error: ' + err.message)
    }
    setBatchEnriching(false)
  }

  const pendingCount = contacts.filter(c => c.enrichment_status === 'pending').length

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="dashboard">
      <header>
        <h1>LatticeIQ</h1>
        <div className="header-actions">
          {pendingCount > 0 && (
            <button onClick={enrichBatch} disabled={batchEnriching} className="enrich-batch-btn">
              {batchEnriching ? 'Enriching...' : `Enrich ${Math.min(pendingCount, 10)} Pending`}
            </button>
          )}
          <button onClick={() => setShowImport(true)} className="import-btn">Import</button>
          <button onClick={onLogout} className="logout-btn">Log Out</button>
        </div>
      </header>
      
      <div className="stats">
        <span>Total: {contacts.length}</span>
        <span>Enriched: {contacts.filter(c => c.enrichment_status === 'enriched').length}</span>
        <span>Pending: {pendingCount}</span>
      </div>
      
      {contacts.length === 0 ? (
        <div className="empty-state">
          <p>No contacts yet.</p>
          <button onClick={() => setShowImport(true)}>Import from CRM</button>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Title</th>
              <th>Status</th>
              <th>APEX</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} className={c.enrichment_status === 'enriched' ? 'enriched' : ''}>
                <td>{c.first_name} {c.last_name}</td>
                <td>{c.company}</td>
                <td>{c.title}</td>
                <td>
                  <span className={`status-badge ${c.enrichment_status}`}>
                    {c.enrichment_status || 'pending'}
                  </span>
                </td>
                <td className="apex-score">{c.apex_score || '-'}</td>
                <td className="actions">
                  {c.enrichment_status === 'enriched' ? (
                    <button onClick={() => setSelectedContact(c)} className="view-btn">
                      View Profile
                    </button>
                  ) : (
                    <button 
                      onClick={() => enrichContact(c.id)} 
                      disabled={enriching === c.id}
                      className="enrich-btn"
                    >
                      {enriching === c.id ? '⏳' : '🔍 Enrich'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedContact && (
        <ContactProfile contact={selectedContact} onClose={() => setSelectedContact(null)} />
      )}

      {showImport && (
        <ImportModal token={token} onClose={() => setShowImport(false)} onSuccess={fetchContacts} />
      )}
    </div>
  )
}

function ImportModal({ token, onClose, onSuccess }: { token: string, onClose: () => void, onSuccess: () => void }) {
  const [importType, setImportType] = useState<'hubspot' | 'csv' | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [hubspotToken, setHubspotToken] = useState('')
  const [maxContacts, setMaxContacts] = useState(50)

  const doImport = async (endpoint: string, body: object) => {
    setImporting(true)
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      setResult(data)
      if (data.success && data.imported > 0) onSuccess()
    } catch (err: any) {
      setResult({ error: err.message })
    }
    setImporting(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Import Contacts</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {!importType && (
          <div className="import-options">
            <button onClick={() => setImportType('hubspot')} className="import-btn hubspot">HubSpot</button>
            <button onClick={() => setImportType('csv')} className="import-btn csv">CSV Upload</button>
          </div>
        )}

        {importType === 'hubspot' && (
          <div className="import-form">
            <button onClick={() => setImportType(null)} className="back-btn">← Back</button>
            <h3>HubSpot Import</h3>
            <input
              type="password"
              placeholder="HubSpot Private App Access Token"
              value={hubspotToken}
              onChange={e => setHubspotToken(e.target.value)}
            />
            <select value={maxContacts} onChange={e => setMaxContacts(Number(e.target.value))}>
              <option value={10}>10 contacts</option>
              <option value={50}>50 contacts</option>
              <option value={100}>100 contacts</option>
            </select>
            <button onClick={() => doImport('/api/import/hubspot', { access_token: hubspotToken, max_contacts: maxContacts })} disabled={importing || !hubspotToken}>
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>
        )}

        {importType === 'csv' && (
          <div className="import-form">
            <button onClick={() => setImportType(null)} className="back-btn">← Back</button>
            <h3>CSV Upload</h3>
            <input
              type="file"
              accept=".csv"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  file.text().then(text => doImport('/api/import/csv', { csv_content: text }))
                }
              }}
            />
          </div>
        )}

        {result && (
          <div className={`import-result ${result.error ? 'error' : 'success'}`}>
            {result.success ? (
              <p>✅ Imported {result.imported} contacts</p>
            ) : (
              <p>❌ {result.error || result.detail}</p>
            )}
          </div>
        )}
      </div>
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
