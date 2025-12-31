// ============================================================================
// FILE: frontend/src/components/ContactsTable.tsx
// Contacts table with score columns
// ============================================================================
import { useState } from 'react';
import { Contact } from '../types';
import { Zap, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface ContactsTableProps {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onEnrichContact: (contactId: string) => void;
  onDeleteContact: (contactId: string) => void;
  enrichingIds: Set<string>;
}

type SortField = 'name' | 'email' | 'company' | 'status' | 'mdcp_score' | 'bant_score' | 'spice_score';
type SortDirection = 'asc' | 'desc';

// Score badge component
function ScoreBadge({ score, label }: { score: number | null | undefined; label: string }) {
  if (score === null || score === undefined) {
    return <span className="text-slate-500 text-xs">—</span>;
  }

  let bgColor = 'bg-slate-700 text-slate-300';
  let tier = 'Cold';

  if (score >= 71) {
    bgColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    tier = 'Hot';
  } else if (score >= 40) {
    bgColor = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    tier = 'Warm';
  } else {
    bgColor = 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
    tier = 'Cold';
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}>
        {score}
      </span>
      <span className="text-[10px] text-slate-500">{tier}</span>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    processing: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.pending}`}>
      {status || 'pending'}
    </span>
  );
}

export function ContactsTable({
  contacts,
  onSelectContact,
  onEnrichContact,
  onDeleteContact,
  enrichingIds,
}: ContactsTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedContacts = [...contacts].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField) {
      case 'name':
        aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
        bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
        break;
      case 'email':
        aVal = a.email?.toLowerCase() || '';
        bVal = b.email?.toLowerCase() || '';
        break;
      case 'company':
        aVal = a.company?.toLowerCase() || '';
        bVal = b.company?.toLowerCase() || '';
        break;
      case 'status':
        aVal = a.enrichment_status || '';
        bVal = b.enrichment_status || '';
        break;
      case 'mdcp_score':
        aVal = a.mdcp_score ?? -1;
        bVal = b.mdcp_score ?? -1;
        break;
      case 'bant_score':
        aVal = a.bant_score ?? -1;
        bVal = b.bant_score ?? -1;
        break;
      case 'spice_score':
        aVal = a.spice_score ?? -1;
        bVal = b.spice_score ?? -1;
        break;
      default:
        aVal = '';
        bVal = '';
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-cyan-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600',
      'bg-purple-600', 'bg-blue-600', 'bg-pink-600', 'bg-indigo-600',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th
              className="text-left py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-slate-200"
              onClick={() => handleSort('name')}
            >
              Contact <SortIcon field="name" />
            </th>
            <th
              className="text-left py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-slate-200"
              onClick={() => handleSort('company')}
            >
              Company <SortIcon field="company" />
            </th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">
              Title
            </th>
            <th
              className="text-center py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-slate-200"
              onClick={() => handleSort('mdcp_score')}
            >
              MDCP <SortIcon field="mdcp_score" />
            </th>
            <th
              className="text-center py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-slate-200"
              onClick={() => handleSort('bant_score')}
            >
              BANT <SortIcon field="bant_score" />
            </th>
            <th
              className="text-center py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-slate-200"
              onClick={() => handleSort('spice_score')}
            >
              SPICE <SortIcon field="spice_score" />
            </th>
            <th
              className="text-center py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-slate-200"
              onClick={() => handleSort('status')}
            >
              Status <SortIcon field="status" />
            </th>
            <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedContacts.map((contact) => {
            const isEnriching = enrichingIds.has(contact.id);
            const fullName = `${contact.first_name} ${contact.last_name}`;

            return (
              <tr
                key={contact.id}
                className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                onClick={() => onSelectContact(contact)}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${getAvatarColor(fullName)} flex items-center justify-center text-white font-medium text-sm`}>
                      {getInitials(contact.first_name, contact.last_name)}
                    </div>
                    <div>
                      <div className="text-slate-200 font-medium">{fullName}</div>
                      <div className="text-slate-500 text-sm">{contact.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-300">{contact.company || '—'}</td>
                <td className="py-3 px-4 text-slate-400 text-sm">{contact.title || '—'}</td>
                <td className="py-3 px-4 text-center">
                  <ScoreBadge score={contact.mdcp_score} label="MDCP" />
                </td>
                <td className="py-3 px-4 text-center">
                  <ScoreBadge score={contact.bant_score} label="BANT" />
                </td>
                <td className="py-3 px-4 text-center">
                  <ScoreBadge score={contact.spice_score} label="SPICE" />
                </td>
                <td className="py-3 px-4 text-center">
                  <StatusBadge status={contact.enrichment_status || 'pending'} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnrichContact(contact.id);
                      }}
                      disabled={isEnriching}
                      className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Enrich contact"
                    >
                      <Zap className={`w-4 h-4 ${isEnriching ? 'animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteContact(contact.id);
                      }}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete contact"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {contacts.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No contacts found. Add your first contact to get started.
        </div>
      )}
    </div>
  );
}

export default ContactsTable;
