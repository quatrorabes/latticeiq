import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000'

interface Contact {
  id: number
  name: string
  email?: string
  company?: string
  title?: string
  enrichmentstatus?: string
}

function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_URL}/api/v2/contacts?limit=20`)
      .then(res => res.json())
      .then(data => {
        setContacts(data.contacts || [])
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{padding:20,fontFamily:'system-ui'}}>Loading contacts...</div>
  if (error) return <div style={{padding:20,color:'red'}}>Error: {error}</div>

  return (
    <div style={{padding:20,fontFamily:'system-ui',maxWidth:900,margin:'0 auto'}}>
      <h1 style={{marginBottom:5}}>LatticeIQ Dashboard</h1>
      <p style={{color:'#666',marginTop:0}}>Connected to Apex Backend</p>
      <h2>Contacts ({contacts.length})</h2>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr style={{borderBottom:'2px solid #333',textAlign:'left'}}>
            <th style={{padding:8}}>Name</th>
            <th style={{padding:8}}>Company</th>
            <th style={{padding:8}}>Title</th>
            <th style={{padding:8}}>Status</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map(c => (
            <tr key={c.id} style={{borderBottom:'1px solid #ddd'}}>
              <td style={{padding:8}}><Link to={`/contact/${c.id}`} style={{color:'#0066cc'}}>{c.name}</Link></td>
              <td style={{padding:8}}>{c.company || '-'}</td>
              <td style={{padding:8}}>{c.title || '-'}</td>
              <td style={{padding:8}}>{c.enrichmentstatus || 'pending'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ContactDetail() {
  const { id } = useParams()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/v2/contacts/${id}`)
      .then(res => res.json())
      .then(data => {
        setContact(data.contact || data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{padding:20}}>Loading...</div>
  if (!contact) return <div style={{padding:20}}>Contact not found</div>

  return (
    <div style={{padding:20,fontFamily:'system-ui',maxWidth:600,margin:'0 auto'}}>
      <Link to="/" style={{color:'#0066cc'}}>← Back to Dashboard</Link>
      <h1>{contact.name}</h1>
      <p><strong>Company:</strong> {contact.company || 'N/A'}</p>
      <p><strong>Title:</strong> {contact.title || 'N/A'}</p>
      <p><strong>Email:</strong> {contact.email || 'N/A'}</p>
      <p><strong>Status:</strong> {contact.enrichmentstatus || 'pending'}</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/contact/:id" element={<ContactDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
