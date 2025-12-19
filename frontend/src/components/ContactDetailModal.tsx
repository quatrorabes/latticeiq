import { useState } from 'react';

interface Contact {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  title?: string;
  apex_score?: number | null;
  enrichment_data?: any;
  enrichment_status?: string | null;
}

interface ContactDetailModalProps {
  contact: Contact | null;
  isOpen?: boolean;
  onClose: () => void;
  onEnrichComplete?: () => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  contact,
  isOpen = true,
  onClose,
  onEnrichComplete,
}) => {
  const [enriching, setEnriching] = useState(false);

  if (!isOpen || !contact) return null;

  const enrichment = contact.enrichment_data || {};
  const synthesized = enrichment.synthesized || {};

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      if (onEnrichComplete) onEnrichComplete();
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {contact.first_name} {contact.last_name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            &times;
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Email</label>
              <p className="font-medium">{contact.email || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Company</label>
              <p className="font-medium">{contact.company || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Title</label>
              <p className="font-medium">{contact.title || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">APEX Score</label>
              <p className="font-medium">{contact.apex_score ?? '-'}</p>
            </div>
          </div>
          {contact.enrichment_status === 'completed' && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Enrichment Data</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                {JSON.stringify(synthesized, null, 2)}
              </pre>
            </div>
          )}
          {contact.enrichment_status !== 'completed' && (
            <button onClick={handleEnrich} disabled={enriching}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {enriching ? 'Enriching...' : 'Enrich Contact'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactDetailModal;
