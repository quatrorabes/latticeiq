import { useState, useMemo } from 'react'
import { Contact } from '@typings/index'
import { formatDate, getInitials, getDisplayName, getScoreColor, getStatusColor } from '@lib/utils'
import { Search, Trash2, Zap, ChevronUp, ChevronDown } from 'lucide-react'
import Button from './Button'
import Badge from './Badge'
import Card from './Card'
import Input from './Input'

interface ContactsTableProps {
  contacts: Contact[]
  loading?: boolean
  onDelete?: (id: string) => void
  onEnrich?: (contact: Contact) => void
  onSelectContact?: (contact: Contact) => void
  enrichingIds?: Set<string>
}

type SortField = 'name' | 'company' | 'apex_score' | 'enrichment_status' | 'created_at'
type SortOrder = 'asc' | 'desc'

export default function ContactsTable({
  contacts,
  loading = false,
  onDelete,
  onEnrich,
  onSelectContact,
  enrichingIds = new Set(),
}: ContactsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const filteredAndSorted = useMemo(() => {
    let filtered = contacts.filter(contact => {
      const searchLower = searchQuery.toLowerCase()
      const displayName = getDisplayName(contact.first_name || '', contact.last_name || '')
      return (
        displayName.toLowerCase().includes(searchLower) ||
        (contact.email?.toLowerCase() || '').includes(searchLower) ||
        (contact.company?.toLowerCase() || '').includes(searchLower) ||
        (contact.title?.toLowerCase() || '').includes(searchLower)
      )
    })

    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = ''
      let bVal: any = ''

      if (sortField === 'name') {
        aVal = getDisplayName(a.first_name || '', a.last_name || '')
        bVal = getDisplayName(b.first_name || '', b.last_name || '')
      } else if (sortField === 'company') {
        aVal = a.company || ''
        bVal = b.company || ''
      } else if (sortField === 'apex_score') {
        aVal = a.apex_score || 0
        bVal = b.apex_score || 0
      } else if (sortField === 'enrichment_status') {
        aVal = a.enrichment_status || ''
        bVal = b.enrichment_status || ''
      } else if (sortField === 'created_at') {
        aVal = a.created_at || ''
        bVal = b.created_at || ''
      }

      if (aVal === null || aVal === undefined) aVal = ''
      if (bVal === null || bVal === undefined) bVal = ''

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    return sorted
  }, [contacts, searchQuery, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    )
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading contacts...</div>
      </Card>
    )
  }

  if (contacts.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-slate-400 mb-4">No contacts found</p>
        <p className="text-slate-500 text-sm">Import contacts from your CRM to get started</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="Search by name, email, company..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-4"
      />

      <Card variant="elevated" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 hover:text-cyan-400"
                  >
                    Contact <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('company')}
                    className="flex items-center gap-2 hover:text-cyan-400"
                  >
                    Company <SortIcon field="company" />
                  </button>
                </th>
                <th className="text-left p-4">Title</th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('apex_score')}
                    className="flex items-center gap-2 hover:text-cyan-400"
                  >
                    Score <SortIcon field="apex_score" />
                  </button>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('enrichment_status')}
                    className="flex items-center gap-2 hover:text-cyan-400"
                  >
                    Status <SortIcon field="enrichment_status" />
                  </button>
                </th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => onSelectContact?.(contact)}
                  className="cursor-pointer hover:bg-slate-800 transition-colors border-b border-slate-800"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {getInitials(contact.first_name || '', contact.last_name || '')}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {getDisplayName(contact.first_name || '', contact.last_name || '')}
                        </p>
                        <p className="text-slate-400 text-xs">{contact.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300">{contact.company || '-'}</td>
                  <td className="p-4 text-slate-300">{contact.title || '-'}</td>
                  <td className="p-4">
                    {contact.apex_score ? (
                      <Badge variant="info" size="sm">
                        {Math.round(contact.apex_score)}
                      </Badge>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={
                        contact.enrichment_status === 'completed'
                          ? 'success'
                          : contact.enrichment_status === 'processing'
                          ? 'warning'
                          : contact.enrichment_status === 'failed'
                          ? 'error'
                          : 'default'
                      }
                      size="sm"
                    >
                      {contact.enrichment_status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {contact.enrichment_status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEnrich?.(contact)
                          }}
                          isLoading={enrichingIds.has(contact.id)}
                          disabled={enrichingIds.has(contact.id)}
                        >
                          <Zap className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm('Delete this contact?')) {
                            onDelete?.(contact.id)
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-sm text-slate-400">
        Showing {filteredAndSorted.length} of {contacts.length} contacts
      </div>
    </div>
  )
}
