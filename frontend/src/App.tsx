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
}

interface ImportResult {
  success?: boolean
  imported?: number
  filtered?: number
  duplicates?: number
  filter_reasons?: Record<string, number>
  error?: string
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
        {isSignUp ? 'Have an account? Log in' : "Need an account? Sign up"}
      </p>
    </div>
  )
}

function ImportModal({ token, onClose, onSuccess }: { token: string, onClose: () => void, onSuccess: () => void }) {
  const [importType, setImportType] = useState<'hubspot' | 'salesforce' | 'pipedrive' | 'csv' | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  
  const [hubspotToken, setHubspotToken] = useState('')
  const [sfInstanceUrl, setSfInstanceUrl] = useState('')
  const [sfAccessToken, setSfAccessToken] = useState('')
  const [pipedriveToken, setPipedriveToken] = useState('')
  const [filterDnc, setFilterDnc] = useState(true)
  const [maxContacts, setMaxContacts] = useState(50)

  const doImport = async (endpoint: string, body: object) => {
    setImporting(true)
    setResult(null)
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Import failed')
      setResult(data)
      if (data.success && data.imported > 0) onSuccess()
    } catch (err: any) {
      setResult({ error: err.message })
    }
    setImporting(false)
  }

  const handleHubSpot = () => doImport('/api/import/hubspot', {
    access_token: hubspotToken,
    max_contacts: maxContacts,
    filter_dnc: filterDnc
  })

  const handleSalesforce = () => doImport('/api/import/salesforce', {
    instance_url: sfInstanceUrl,
    access_token: sfAccessToken,
    max_contacts: maxContacts,
    filter_dnc: filterDnc
  })

  const handlePipedrive = () => doImport('/api/import/pipedrive', {
    api_token: pipedriveToken,
    max_contacts: maxContacts,
    filter_dnc: filterDnc
  })

  const handleCSV = async (file: File) => {
    const text = await file.text()
    doImport('/api/import/csv', {
      csv_content: text,
      filter_dnc: filterDnc
    })
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
            <button onClick={() => setImportType('hubspot')} className="import-btn hubspot">
              <span>🟠</span> HubSpot
            </button>
            <button onClick={() => setImportType('salesforce')} className="import-btn salesforce">
              <span>☁️</span> Salesforce
            </button>
            <button onClick={() => setImportType('pipedrive')} className="import-btn pipedrive">
              <span>🟢</span> Pipedrive
            </button>
            <button onClick={() => setImportType('csv')} className="import-btn csv">
              <span>📄</span> CSV Upload
            </button>
          </div>
        )}

        {importType && (
          <div className="import-form">
            <button onClick={() => { setImportType(null); setResult(null) }} className="back-btn">
              ← Back
            </button>

            <label className="filter-toggle">
              <input type="checkbox" checked={filterDnc} onChange={e => setFilterDnc(e.target.checked)} />
              Filter out unqualified/unsubscribed/DNC contacts
            </label>

            {importType === 'hubspot' && (
              <>
                <h3>HubSpot Import</h3>
                <input
                  type="password"
                  placeholder="HubSpot Private App Access Token"
                  value={hubspotToken}
                  onChange={e => setHubspotToken(e.target.value)}
                />
                <p className="hint">Get from HubSpot → Settings → Integrations → Private Apps</p>
                <div className="max-contacts">
                  <label>Max contacts:</label>
                  <select value={maxContacts} onChange={e => setMaxContacts(Number(e.target.value))}>
                    <option value={10}>10 (test)</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>
                <button onClick={handleHubSpot} disabled={importing || !hubspotToken}>
                  {importing ? 'Importing...' : `Import ${maxContacts} from HubSpot`}
                </button>
              </>
            )}

            {importType === 'salesforce' && (
              <>
                <h3>Salesforce Import</h3>
                <input
                  type="text"
                  placeholder="Instance URL (e.g., https://yourorg.salesforce.com)"
                  value={sfInstanceUrl}
                  onChange={e => setSfInstanceUrl(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Access Token"
                  value={sfAccessToken}
                  onChange={e => setSfAccessToken(e.target.value)}
                />
                <p className="hint">Use OAuth or Connected App to get access token</p>
                <div className="max-contacts">
                  <label>Max contacts:</label>
                  <select value={maxContacts} onChange={e => setMaxContacts(Number(e.target.value))}>
                    <option value={10}>10 (test)</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>
                <button onClick={handleSalesforce} disabled={importing || !sfInstanceUrl || !sfAccessToken}>
                  {importing ? 'Importing...' : `Import ${maxContacts} from Salesforce`}
                </button>
              </>
            )}

            {importType === 'pipedrive' && (
              <>
                <h3>Pipedrive Import</h3>
                <input
                  type="password"
                  placeholder="Pipedrive API Token"
                  value={pipedriveToken}
                  onChange={e => setPipedriveToken(e.target.value)}
                />
                <p className="hint">Get from Pipedrive → Settings → Personal preferences → API</p>
                <div className="max-contacts">
                  <label>Max contacts:</label>
                  <select value={maxContacts} onChange={e => setMaxContacts(Number(e.target.value))}>
                    <option value={10}>10 (test)</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>
                <button onClick={handlePipedrive} disabled={importing || !pipedriveToken}>
                  {importing ? 'Importing...' : `Import ${maxContacts} from Pipedrive`}
                </button>
              </>
            )}

            {importType === 'csv' && (
              <>
                <h3>CSV Upload</h3>
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => e.target.files?.[0] && handleCSV(e.target.files[0])}
                  disabled={importing}
                />
                <p className="hint">Auto-maps columns: first name, last name, email, company, title, phone, linkedin</p>
              </>
            )}
          </div>
        )}

        {result && (
          <div className={`import-result ${result.error ? 'error' : 'success'}`}>
            {result.success ? (
              <>
                <p>✅ <strong>{result.imported}</strong> contacts imported</p>
                <p>🚫 <strong>{result.filtered}</strong> filtered (DNC/invalid)</p>
                <p>⚠️ <strong>{result.duplicates}</strong> duplicates skipped</p>
                {result.filter_reasons && Object.keys(result.filter_reasons).length > 0 && (
                  <details>
                    <summary>Filter details</summary>
                    <ul>
                      {Object.entries(result.filter_reasons).map(([reason, count]) => (
                        <li key={reason}>{reason}: {count}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <p>❌ {result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AddContactModal({ token, onClose, onSuccess }: { token: string, onClose: () => void, onSuccess: () => void }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', company: '', title: '', linkedin_url: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      })
      if (!response.ok) throw new Error('Failed to create contact')
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Add Contact</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-row">
            <input placeholder="First Name" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
            <input placeholder="Last Name" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
          </div>
          <input type="email" placeholder="Email *" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <input placeholder="Company" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
          <input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <input placeholder="LinkedIn URL" value={form.linkedin_url} onChange={e => setForm({...form, linkedin_url: e.target.value})} />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Contact'}</button>
        </form>
      </div>
    </div>
  )
}

function Dashboard({ token, onLogout }: { token: string, onLogout: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)

  const fetchContacts = () => {
    fetch(`${API_URL}/api/contacts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setContacts(data.contacts || [])
      setLoading(false)
    })
    .catch(() => setLoading(false))
  }

  useEffect(() => { fetchContacts() }, [token])

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="dashboard">
      <header>
        <h1>LatticeIQ</h1>
        <div className="header-actions">
          <button onClick={() => setShowAddContact(true)} className="add-btn">+ Add Contact</button>
          <button onClick={() => setShowImport(true)} className="import-btn">Import</button>
          <button onClick={onLogout} className="logout-btn">Log Out</button>
        </div>
      </header>
      
      <h2>Your Contacts ({contacts.length})</h2>
      
      {contacts.length === 0 ? (
        <div className="empty-state">
          <p>No contacts yet.</p>
          <div className="empty-actions">
            <button onClick={() => setShowAddContact(true)}>Add Contact</button>
            <button onClick={() => setShowImport(true)}>Import from CRM</button>
          </div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Title</th>
              <th>Email</th>
              <th>Status</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td>{c.first_name} {c.last_name}</td>
                <td>{c.company}</td>
                <td>{c.title}</td>
                <td>{c.email}</td>
                <td><span className={`status ${c.enrichment_status}`}>{c.enrichment_status || 'pending'}</span></td>
                <td>{c.apex_score || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showImport && (
        <ImportModal 
          token={token} 
          onClose={() => setShowImport(false)} 
          onSuccess={fetchContacts} 
        />
      )}

      {showAddContact && (
        <AddContactModal 
          token={token} 
          onClose={() => setShowAddContact(false)} 
          onSuccess={fetchContacts} 
        />
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
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  if (loading) return <div className="loading">Loading...</div>

  return session ? (
    <Dashboard token={session.access_token} onLogout={() => supabase.auth.signOut()} />
  ) : (
    <Auth onLogin={() => supabase.auth.getSession().then(({ data }) => setSession(data.session))} />
  )
}
