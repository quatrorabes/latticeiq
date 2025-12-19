// frontend/src/components/ContactsTable.tsx
import { Contact } from '../types/contact';

interface ContactsTableProps {
  contacts: Contact[];
  onRowClick: (contact: Contact) => void;
  onDelete: (contactId: number) => void;
}

export default function ContactsTable({ contacts, onRowClick, onDelete }: ContactsTableProps) {
  const getScoreBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined) {
      return <span className="text-gray-500">—</span>;
    }
    
    let bgColor = 'bg-gray-600';
    if (score >= 75) bgColor = 'bg-green-600';
    else if (score >= 50) bgColor = 'bg-yellow-600';
    else if (score >= 25) bgColor = 'bg-orange-600';
    else bgColor = 'bg-red-600';
    
    return (
      <span className={`${bgColor} text-white text-xs font-bold px-2 py-1 rounded`}>
        {score}
      </span>
    );
  };

  const getStatusBadge = (status: string | null | undefined) => {
    const statusText = status || 'not_started';
    
    let bgColor = 'bg-gray-700';
    let textColor = 'text-gray-300';
    
    switch (statusText) {
      case 'completed':
        bgColor = 'bg-green-900/50';
        textColor = 'text-green-400';
        break;
      case 'enriching':
      case 'pending':
        bgColor = 'bg-blue-900/50';
        textColor = 'text-blue-400';
        break;
      case 'failed':
        bgColor = 'bg-red-900/50';
        textColor = 'text-red-400';
        break;
    }
    
    return (
      <span className={`${bgColor} ${textColor} text-xs px-2 py-1 rounded capitalize`}>
        {statusText.replace('_', ' ')}
      </span>
    );
  };

  if (contacts.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-400">No contacts found</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-900">
          <tr>
            <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Name</th>
            <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Email</th>
            <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Company</th>
            <th className="text-left text-gray-400 text-sm font-medium px-6 py-4">Title</th>
            <th className="text-center text-gray-400 text-sm font-medium px-6 py-4">APEX</th>
            <th className="text-center text-gray-400 text-sm font-medium px-6 py-4">Status</th>
            <th className="text-center text-gray-400 text-sm font-medium px-6 py-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr
              key={contact.id}
              onClick={() => onRowClick(contact)}
              className="border-t border-gray-700 hover:bg-gray-750 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4">
                <span className="text-white font-medium">
                  {contact.first_name} {contact.last_name}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-gray-300">{contact.email || '—'}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-gray-300">{contact.company}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-gray-300">{contact.title || '—'}</span>
              </td>
              <td className="px-6 py-4 text-center">
                {getScoreBadge(contact.apex_score)}
              </td>
              <td className="px-6 py-4 text-center">
                {getStatusBadge(contact.enrichment_status)}
              </td>
              <td className="px-6 py-4 text-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(contact.id);
                  }}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  title="Delete contact"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
