// Contacts Table Component - Full Featured
import { useState, useMemo } from 'react';
import { useContacts } from '../hooks/useContacts';
import { EnrichButton } from './EnrichButton';
import { ContactDetailModal } from './ContactDetailModal';
import type { Contact } from '../types/contact';
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Trash2,
  CheckSquare,
  Square,
  Loader2,
  AlertCircle,
  User,
  Building2,
  Sparkles
} from 'lucide-react'

type SortField = 'firstname' | 'company' | 'title' | 'apex_score' | 'enrichment_status' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface ContactsTableProps {
  onAddContact?: () => void;
  onImport?: () => void;
}

export function ContactsTable({ onAddContact, onImport }: ContactsTableProps) {
  const { contacts, isLoading, error, refetch, removeContact, removeContacts } = useContacts();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered & sorted contacts
  const filteredContacts = useMemo(() => {
    // Safety check - ensure contacts is always an array
    if (!Array.isArray(contacts)) {
      console.warn('contacts is not an array:', contacts)
      return []
    }
    
    let result = [...contacts]
    
    // Search filter
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
    
    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'enriched') {
        result = result.filter(c => c.enrichment_status === 'completed')
      } else if (filterStatus === 'not_enriched') {
        result = result.filter(c => !c.enrichment_status || c.enrichment_status === 'pending')
      } else if (filterStatus === 'high_score') {
        result = result.filter(c => (c.apex_score ?? 0) >= 75)
      }
    }
    
    // Sort
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
  

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} contact(s)?`)) return;
    
    setIsDeleting(true);
    try {
      await removeContacts(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const getScoreBadge = (score?: number) => {
    if (score == null) return null;
    const tier = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-gray-100 text-gray-600'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[tier]}`}>
        {score}
      </span>
    );
  };

  const getStatusBadge = (status?: string | null) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      completed: { color: 'bg-green-100 text-green-800', label: 'Enriched' },
      processing: { color: 'bg-blue-100 text-blue-800', label: 'Processing' },
      pending: { color: 'bg-gray-100 text-gray-600', label: 'Pending' },
      failed: { color: 'bg-red-100 text-red-800', label: 'Failed' }
    };
    const config = statusConfig[status || 'pending'] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-4 h-4 text-gray-300" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-purple-600" />
      : <ChevronDown className="w-4 h-4 text-purple-600" />;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading contacts...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-600">
        <AlertCircle className="w-12 h-12 mb-3" />
        <p className="font-medium">Failed to load contacts</p>
        <p className="text-sm text-gray-500 mt-1">{error.message}</p>
        <button 
          onClick={refetch}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header & Controls */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          
          {/* Filters & Actions */}
          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Contacts</option>
              <option value="enriched">Enriched</option>
              <option value="not_enriched">Not Enriched</option>
              <option value="high_score">High Score (75+)</option>
            </select>
            
            {/* Bulk Delete */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Delete ({selectedIds.size})</span>
              </button>
            )}
            
            {/* Add & Import */}
            {onImport && (
              <button
                onClick={onImport}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Import
              </button>
            )}
            {onAddContact && (
              <button
                onClick={onAddContact}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                + Add Contact
              </button>
            )}
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {filteredContacts.length} contacts
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-green-500" />
            {contacts.filter(c => c.enrichment_status === 'completed').length} enriched
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            {new Set(contacts.map(c => c.company)).size} companies
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={handleSelectAll} className="p-1 hover:bg-gray-200 rounded">
                  {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-purple-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button 
                  onClick={() => handleSort('firstname')}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                >
                  Name <SortIcon field="firstname" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button 
                  onClick={() => handleSort('company')}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                >
                  Company <SortIcon field="company" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button 
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                >
                  Title <SortIcon field="title" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button 
                  onClick={() => handleSort('apex_score')}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                >
                  APEX <SortIcon field="apex_score" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button 
                  onClick={() => handleSort('enrichment_status')}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                >
                  Status <SortIcon field="enrichment_status" />
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <User className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="font-medium">No contacts found</p>
                    <p className="text-sm mt-1">
                      {searchQuery ? 'Try a different search term' : 'Add or import contacts to get started'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredContacts.map((contact) => (
                <tr 
                  key={contact.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(contact)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleSelectOne(contact.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {selectedIds.has(contact.id) ? (
                        <CheckSquare className="w-5 h-5 text-purple-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {contact.firstname} {contact.lastname}
                      </p>
                      <p className="text-sm text-gray-500">{contact.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{contact.company}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{contact.title || '—'}</td>
                  <td className="px-4 py-3">{getScoreBadge(contact.apex_score)}</td>
                  <td className="px-4 py-3">{getStatusBadge(contact.enrichment_status)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <EnrichButton
                        contactId={contact.id}
                        enrichmentStatus={contact.enrichment_status || undefined}
                        onEnrichComplete={refetch}
                        variant="icon"
                      />
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('Delete this contact?')) {
                            await removeContact(contact.id);
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
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

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onEnrichComplete={refetch}
        />
      )}
    </div>
  );
}
