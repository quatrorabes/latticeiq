import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { ContactsTable } from './components/ContactsTable'

import { LogOut, X, Loader2, Zap } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ============================================
// AUTH COMPONENT
// ============================================
function Auth({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) setError(error.message)
    else onLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            <Zap className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">LatticeIQ</h1>
          <p className="text-gray-500 mt-1">Sales Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          {isSignUp ? 'Have an account? ' : "Need an account? "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-purple-600 font-medium hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ============================================
// ADD CONTACT MODAL
// ============================================
interface AddContactModalProps {
  onClose: () => void
  onSuccess: () => void
}

function AddContactModal({ onClose, onSuccess }: AddContactModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    linkedin_url: '',
    website: '',
    vertical: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Failed to create contact')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">Add Contact</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  name="firstname"
                  value={formData.firstname}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                <input
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
              <input
                name="linkedin_url"
                value={formData.linkedin_url}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vertical</label>
              <select
                name="vertical"
                value={formData.vertical}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select vertical...</option>
                <option value="saas">SaaS</option>
                <option value="insurance">Insurance</option>
                <option value="equipment">Equipment Finance</option>
                <option value="healthcare">Healthcare</option>
                <option value="finance">Finance</option>
                <option value="other">Other</option>
              </select>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Contact
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============================================
// IMPORT MODAL
// ============================================
interface ImportModalProps {
  onClose: () => void
  onSuccess: () => void
}

function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [source, setSource] = useState<'hubspot' | 'salesforce' | 'pipedrive' | 'csv'>('hubspot')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported?: number; error?: string } | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [filters, setFilters] = useState({
    excludeDNC: true,
    excludeUnsubscribed: true
  })

  const handleImport = async () => {
    setLoading(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${session?.access_token}`
      }

      let response: Response

      if (source === 'csv' && csvFile) {
        const formData = new FormData()
        formData.append('file', csvFile)
        formData.append('exclude_dnc', String(filters.excludeDNC))
        formData.append('exclude_unsubscribed', String(filters.excludeUnsubscribed))
        
        response = await fetch(`${API_URL}/api/import/csv`, {
          method: 'POST',
          headers,
          body: formData
        })
      } else {
        headers['Content-Type'] = 'application/json'
        response = await fetch(`${API_URL}/api/import/${source}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            exclude_dnc: filters.excludeDNC,
            exclude_unsubscribed: filters.excludeUnsubscribed
          })
        })
      }

      const data = await response.json()
      
      if (response.ok) {
        setResult({ imported: data.imported || data.count || 0 })
        onSuccess()
      } else {
        setResult({ error: data.detail || data.error || 'Import failed' })
      }
    } catch (err: any) {
      setResult({ error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const sources = [
    { id: 'hubspot', name: 'HubSpot', icon: '🟠' },
    { id: 'salesforce', name: 'Salesforce', icon: '☁️' },
    { id: 'pipedrive', name: 'Pipedrive', icon: '🟢' },
    { id: 'csv', name: 'CSV File', icon: '📄' }
  ] as const

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-900">Import Contacts</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Select Source</label>
              <div className="grid grid-cols-2 gap-3">
                {sources.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSource(s.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      source === s.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <p className="font-medium mt-2">{s.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* CSV Upload */}
            {source === 'csv' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                {csvFile && (
                  <p className="text-sm text-green-600 mt-2">✓ {csvFile.name}</p>
                )}
              </div>
            )}

            {/* Filters */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Filters</label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={filters.excludeDNC}
                  onChange={(e) => setFilters(f => ({ ...f, excludeDNC: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Exclude DNC (Do Not Call)</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={filters.excludeUnsubscribed}
                  onChange={(e) => setFilters(f => ({ ...f, excludeUnsubscribed: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Exclude Unsubscribed</span>
              </label>
            </div>

            {/* Result */}
            {result && (
              <div className={`p-4 rounded-lg ${
                result.imported !== undefined
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {result.imported !== undefined
                  ? `✅ Successfully imported ${result.imported} contacts`
                  : `❌ ${result.error}`
                }
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {result?.imported !== undefined ? 'Done' : 'Cancel'}
              </button>
              {result?.imported === undefined && (
                <button
                  onClick={handleImport}
                  disabled={loading || (source === 'csv' && !csvFile)}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Import
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN DASHBOARD
// ============================================
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const handleRefresh = () => {
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">LatticeIQ</span>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 mt-1">Manage and enrich your sales contacts</p>
        </div>

        {/* Contacts Table */}
        <ContactsTable
          key={refreshKey}
          onAddContact={() => setShowAddModal(true)}
          onImport={() => setShowImportModal(true)}
        />
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleRefresh}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  )
}

// ============================================
// APP ROOT
// ============================================
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
  }

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    )
  }

  // Auth or Dashboard
  return isAuthenticated ? (
    <Dashboard onLogout={handleLogout} />
  ) : (
    <Auth onLogin={() => setIsAuthenticated(true)} />
  )
}

export default App
