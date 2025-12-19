import { useState, useMemo } from 'react'
import { useContacts } from '../hooks/useContacts'
import { EnrichButton } from './EnrichButton'
import { ContactDetailModal } from './ContactDetailModal'
import type { Contact } from '../types/contact'
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Trash2,
  CheckSquare,
  Square,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

type SortField = 'firstname' | 'company' | 'title' | 'apex_score' | 'enrichment_status' | 'created_at'
type SortDirection = 'asc' | 'desc'

interface ContactsTableProps {
  onAddContact?: () => void
  onImport?: () => void
}

export function ContactsTable({ onAddContact, onImport }: ContactsTableProps) {
  const { contacts, isLoading, error, refetch, removeContact, removeContacts } = useContacts()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredContacts = useMemo(() => {
    if (!Array.isArray(contacts)) return []
    
    let result = [...contacts]
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c => 
        c.firstname?.toLowerCase().includes(query) ||
        c.lastname?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query) ||
        c.title?.toLowerCase().includes(query)
      )
    }
    
    if (filterStatus !== 'all') {
      if (filterStatus === 'enriched') {
        result = result.filter(c => c.enrichment_status === 'completed')
      } else if (filterStatus === 'not_enriched') {
        result = result.filter(c => !c.enrichment_status || c.enrichment_status === 'pending')
      } else if (filterStatus === 'high_score') {
        result = result.filter(c => (c.apex_score ?? 0) >= 75)
      }
    }
    
    result.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]
      
      if (aVal == null) aVal = sortDirection === 'asc' ? Infinity : -Infinity
      if (bVal == null) bVal = sortDirection === 'asc' ? Infinity : -Infinity
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    return result
  }, [contacts, searchQuery, sortField, sortDirection, filterStatus])

  const stats = useMemo(() => ({
    total: contacts.length,
    enriched: contacts.filter(c => c.enrichment_status === 'completed').length,
    companies: new Set(contacts.map(c => c.company).filter(Boolean)).size
  }), [contacts])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)))
    }
  }

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} contact(s)?`)) return
    
    setIsDeleting(true)
    try {
      await removeContacts(Array.from(selectedIds))
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const getDisplayName = (contact: Contact) => {
    if (contact.firstname || contact.lastname) {
      return `${contact.firstname || ''} ${contact.lastname || ''}`.trim()
    }
    return contact.email?.split('@')[0] || 'Unknown'
  }

  const getInitials = (contact: Contact) => {
    if (contact.firstname && contact.lastname) {
      return `${contact.firstname[0]}${contact.lastname[0]}`.toUpperCase()
    }
    if (contact.firstname) return contact.firstname[0].toUpperCase()
    if (contact.email) return contact.email[0].toUpperCase()
    return '?'
  }

  const getScoreBadge = (score?: number) => {
    if (score == null) return <span style={{ color: '#6b7280' }}>—</span>
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#6b7280'
    return (
      <span style={{ 
        padding: '4px 10px', 
        borderRadius: '12px', 
        fontSize: '12px', 
        fontWeight: 'bold',
        backgroundColor: `${color}20`,
        color: color
      }}>
        {score}
      </span>
    )
  }

  const getStatusBadge = (status?: string | null) => {
    const configs: Record<string, { color: string; label: string }> = {
      completed: { color: '#22c55e', label: '✓ Enriched' },
      processing: { color: '#3b82f6', label: '⟳ Processing' },
      pending: { color: '#6b7280', label: 'Pending' },
      failed: { color: '#ef4444', label: '✗ Failed' }
    }
    const c = configs[status || 'pending'] || configs.pending
    return (
      <span style={{ 
        padding: '4px 10px', 
        borderRadius: '12px', 
        fontSize: '12px',
        backgroundColor: `${c.color}20`,
        color: c.color
      }}>
        {c.label}
      </span>
    )
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
        <Loader2 style={{ width: 32, height: 32, color: '#a855f7', animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 12, color: '#9ca3af' }}>Loading contacts...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <AlertCircle style={{ width: 48, height: 48, color: '#ef4444', margin: '0 auto 16px' }} />
        <p style={{ color: 'white', fontWeight: 500, marginBottom: 8 }}>Failed to load contacts</p>
        <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 16 }}>{error.message}</p>
        <button 
          onClick={refetch}
          style={{ padding: '8px 16px', backgroundColor: '#a855f7', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Stats Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '24px', 
        marginBottom: '24px',
        padding: '16px 20px',
        backgroundColor: '#1f2937',
        borderRadius: '12px',
        border: '1px solid #374151'
      }}>
        <div>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>{stats.total}</span>
          <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '14px' }}>contacts</span>
        </div>
        <div style={{ borderLeft: '1px solid #374151', paddingLeft: '24px' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>{stats.enriched}</span>
          <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '14px' }}>enriched</span>
        </div>
        <div style={{ borderLeft: '1px solid #374151', paddingLeft: '24px' }}>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{stats.companies}</span>
          <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '14px' }}>companies</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, color: '#6b7280' }} />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '10px 12px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px'
            }}
          >
            <option value="all">All Contacts</option>
            <option value="enriched">Enriched</option>
            <option value="not_enriched">Not Enriched</option>
            <option value="high_score">High Score (75+)</option>
          </select>

          <button
            onClick={refetch}
            style={{ padding: '10px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#9ca3af', cursor: 'pointer' }}
            title="Refresh"
          >
            <RefreshCw style={{ width: 20, height: 20 }} />
          </button>
          
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '10px 16px', 
                backgroundColor: '#7f1d1d', 
                border: '1px solid #991b1b', 
                borderRadius: '8px', 
                color: '#fca5a5', 
                cursor: 'pointer' 
              }}
            >
              <Trash2 style={{ width: 16, height: 16 }} />
              Delete ({selectedIds.size})
            </button>
          )}
          
          {onImport && (
            <button
              onClick={onImport}
              style={{ padding: '10px 16px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
            >
              Import
            </button>
          )}
          {onAddContact && (
            <button
              onClick={onAddContact}
              style={{ padding: '10px 16px', backgroundColor: '#9333ea', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 500, cursor: 'pointer' }}
            >
              + Add Contact
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#1f2937', borderRadius: '12px', border: '1px solid #374151', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#111827' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', width: '48px' }}>
                <button onClick={handleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? (
                    <CheckSquare style={{ width: 20, height: 20, color: '#a855f7' }} />
                  ) : (
                    <Square style={{ width: 20, height: 20, color: '#4b5563' }} />
                  )}
                </button>
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                <button onClick={() => handleSort('firstname')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Contact
                  {sortField === 'firstname' && (sortDirection === 'asc' ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />)}
                </button>
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                <button onClick={() => handleSort('company')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Company
                  {sortField === 'company' && (sortDirection === 'asc' ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />)}
                </button>
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>
                <button onClick={() => handleSort('title')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Title
                  {sortField === 'title' && (sortDirection === 'asc' ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />)}
                </button>
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'center', width: '80px' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>APEX</span>
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'center', width: '120px' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Status</span>
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'center', width: '100px' }}>
                <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '60px', textAlign: 'center' }}>
                  <p style={{ color: 'white', marginBottom: 4 }}>No contacts found</p>
                  <p style={{ color: '#6b7280', fontSize: 14 }}>
                    {searchQuery ? 'Try a different search' : 'Add or import contacts to get started'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredContacts.map((contact) => (
                <tr 
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  style={{ borderTop: '1px solid #374151', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleSelectOne(contact.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      {selectedIds.has(contact.id) ? (
                        <CheckSquare style={{ width: 20, height: 20, color: '#a855f7' }} />
                      ) : (
                        <Square style={{ width: 20, height: 20, color: '#4b5563' }} />
                      )}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #9333ea, #3b82f6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: 14
                      }}>
                        {getInitials(contact)}
                      </div>
                      <div>
                        <p style={{ color: 'white', fontWeight: 500, margin: 0 }}>{getDisplayName(contact)}</p>
                        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{contact.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#d1d5db' }}>{contact.company || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 14, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {contact.title || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {getScoreBadge(contact.apex_score ?? undefined)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {getStatusBadge(contact.enrichment_status)}
                  </td>
                  <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <EnrichButton
                        contactId={contact.id}
                        enrichmentStatus={contact.enrichment_status || undefined}
                        onEnrichComplete={refetch}
                        variant="icon"
                      />
                      <button
                        onClick={async () => {
                          if (confirm('Delete this contact?')) {
                            await removeContact(contact.id)
                          }
                        }}
                        style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, color: '#6b7280' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                      >
                        <Trash2 style={{ width: 18, height: 18 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 12, padding: '0 4px', color: '#6b7280', fontSize: 13 }}>
        Showing {filteredContacts.length} of {contacts.length} contacts
      </div>

      {/* Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onEnrichComplete={refetch}
        />
      )}
    </div>
  )
}
