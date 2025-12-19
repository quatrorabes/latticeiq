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
  Users,
  Building2,
  Sparkles,
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
    companies: new Set(contacts.map(c => c.company).filter(Boolean)).size,
    highScore: contacts.filter(c => (c.apex_score ?? 0) >= 75).length
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
    if (score == null) return <span className="text-gray-400">—</span>
    const tier = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'
    const colors = {
      high: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colors[tier]}`}>
        {score}
      </span>
    )
  }

  const getStatusBadge = (status?: string | null) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: '✓ Enriched' },
      processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '⟳ Processing' },
      pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: '✗ Failed' }
    }
    const c = config[status || 'pending'] || config.pending
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    )
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button 
      onClick={() => handleSort(field)}
      className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-white transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-purple-400" />
      ) : (
        <ChevronUp className="w-4 h-4 opacity-30" />
      )}
    </button>
  )

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-12">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
          <p className="text-gray-400">Loading contacts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl border border-red-800/50 p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-white font-medium mb-2">Failed to load contacts</p>
          <p className="text-gray-400 text-sm mb-4">{error.message}</p>
          <button onClick={refetch} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Contacts</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.enriched}</p>
              <p className="text-xs text-gray-500">Enriched</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.companies}</p>
              <p className="text-xs text-gray-500">Companies</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <span className="text-yellow-400 text-lg">🔥</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.highScore}</p>
              <p className="text-xs text-gray-500">High Score (75+)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, email, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Contacts</option>
                <option value="enriched">Enriched</option>
                <option value="not_enriched">Not Enriched</option>
                <option value="high_score">High Score (75+)</option>
              </select>

              <button
                onClick={refetch}
                className="p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              
              {selectedIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete ({selectedIds.size})
                </button>
              )}
              
              {onImport && (
                <button
                  onClick={onImport}
                  className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-gray-600 transition-colors"
                >
                  Import
                </button>
              )}
              {onAddContact && (
                <button
                  onClick={onAddContact}
                  className="px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  + Add Contact
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <button onClick={handleSelectAll} className="p-1 hover:bg-gray-700 rounded">
                    {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-purple-400" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left"><SortHeader field="firstname">Contact</SortHeader></th>
                <th className="px-4 py-3 text-left"><SortHeader field="company">Company</SortHeader></th>
                <th className="px-4 py-3 text-left"><SortHeader field="title">Title</SortHeader></th>
                <th className="px-4 py-3 text-center w-24"><SortHeader field="apex_score">APEX</SortHeader></th>
                <th className="px-4 py-3 text-center w-32"><SortHeader field="enrichment_status">Status</SortHeader></th>
                <th className="px-4 py-3 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-white font-medium mb-1">No contacts found</p>
                    <p className="text-gray-500 text-sm">
                      {searchQuery ? 'Try a different search' : 'Add or import contacts to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr 
                    key={contact.id}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedContact(contact)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleSelectOne(contact.id)} className="p-1 hover:bg-gray-700 rounded">
                        {selectedIds.has(contact.id) ? (
                          <CheckSquare className="w-5 h-5 text-purple-400" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                          {getInitials(contact)}
                        </div>
                        <div>
                          <p className="text-white font-medium">{getDisplayName(contact)}</p>
                          <p className="text-gray-500 text-sm">{contact.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300">{contact.company || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-400 text-sm line-clamp-1">{contact.title || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getScoreBadge(contact.apex_score)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(contact.enrichment_status)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
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
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
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
        <div className="px-4 py-3 border-t border-gray-800 text-sm text-gray-500">
          Showing {filteredContacts.length} of {contacts.length} contacts
        </div>
      </div>

      {/* Contact Detail Modal */}
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
