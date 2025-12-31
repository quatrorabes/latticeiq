
import { useState, useMemo } from 'react'
import { Contact } from '@types/index'
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
      return (
        getDisplayName(contact.first_name, contact.last_name).toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        contact.company?.toLowerCase().includes(searchLower) ||
        contact.title?.toLowerCase().includes(searchLower)
      )
    })

    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      if (sortField === 'name') {
        aVal = getDisplayName(a.first_name, a.last_name)
        bVal = getDisplayName(b.first_name, b.last_name)
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
          <table>
            <thead>
              <tr>
                <th>
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 hover:text-primary-400"
                  >
                    Contact <SortIcon field="name" />
                  </button>
                </th>
                <th>
                  <button
                    onClick={() => handleSort('company')}
                    className="flex items-center gap-2 hover:text-primary-400"
                  >
                    Company <SortIcon field="company" />
                  </button>
                </th>
                <th>Title</th>
                <th>
                  <button
                    onClick={() => handleSort('apex_score')}
                    className="flex items-center gap-2 hover:text-primary-400"
                  >
                    Score <SortIcon field="apex_score" />
                  </button>
                </th>
                <th>
                  <button
                    onClick={() => handleSort('enrichment_status')}
                    className="flex items-center gap-2 hover:text-primary-400"
                  >
                    Status <SortIcon field="enrichment_status" />
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => onSelectContact?.(contact)}
                  className="cursor-pointer"
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {getInitials(contact.first_name, contact.last_name)}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {getDisplayName(contact.first_name, contact.last_name)}
                        </p>
                        <p className="text-slate-400 text-sm">{contact.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>{contact.company || '-'}</td>
                  <td>{contact.title || '-'}</td>
                  <td>
                    {contact.apex_score ? (
                      <Badge variant="info" size="sm" className={`bg-opacity-20 ${getScoreColor(contact.apex_score)}`}>
                        {Math.round(contact.apex_score)}
                      </Badge>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td>
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
                  <td>
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
                          Enrich
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