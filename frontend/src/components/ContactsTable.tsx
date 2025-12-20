// frontend/src/components/ContactsTable.tsx
import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Contact } from "../types/contact";
import EnrichButton from "./EnrichButton";
import ContactDetailModal from "./ContactDetailModal";

interface ContactsTableProps {
  contacts: Contact[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export default function ContactsTable({
  contacts,
  onDelete,
  onRefresh,
  isLoading = false,
}: ContactsTableProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContact(null);
  };

  const handleEnrichComplete = () => {
    onRefresh();
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: Record<string, string> = {
      pending: "bg-gray-500/20 text-gray-400",
      processing: "bg-yellow-500/20 text-yellow-400",
      completed: "bg-green-500/20 text-green-400",
      failed: "bg-red-500/20 text-red-400",
    };

    return (
      <span
        className={`
          px-2 py-0.5 rounded-full text-xs font-medium capitalize
          ${statusClasses[status] || statusClasses.pending}
        `}
      >
        {status}
      </span>
    );
  };

  const getScoreDisplay = (score: number | null | undefined) => {
    if (score === null || score === undefined) return <span className="text-gray-600">—</span>;

    let colorClass = "text-gray-400";
    if (score >= 80) colorClass = "text-green-400";
    else if (score >= 60) colorClass = "text-yellow-400";
    else if (score >= 40) colorClass = "text-orange-400";
    else colorClass = "text-red-400";

    return <span className={`font-semibold ${colorClass}`}>{score}</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No contacts found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Company</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">APEX</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                onClick={() => handleRowClick(contact)}
                className="hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="py-3 px-4">
                  <p className="text-sm font-medium text-white">
                    {contact.first_name} {contact.last_name}
                  </p>
                </td>
                <td className="py-3 px-4">
                  <p className="text-sm text-gray-400">{contact.email}</p>
                </td>
                <td className="py-3 px-4">
                  <p className="text-sm text-gray-400">{contact.company || "—"}</p>
                </td>
                <td className="py-3 px-4">
                  <p className="text-sm text-gray-400">{contact.title || "—"}</p>
                </td>
                <td className="py-3 px-4 text-center">{getScoreDisplay(contact.apex_score)}</td>
                <td className="py-3 px-4 text-center">{getStatusBadge(contact.enrichment_status)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <EnrichButton
                      contactId={contact.id}
                      currentStatus={contact.enrichment_status}
                      onEnrichmentComplete={handleEnrichComplete}
                      size="sm"
                      showLabel={false}
                    />
                    <button
                      onClick={() => onDelete(contact.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContactDetailModal
        contact={selectedContact}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onEnrichComplete={handleEnrichComplete}
      />
    </>
  );
}
