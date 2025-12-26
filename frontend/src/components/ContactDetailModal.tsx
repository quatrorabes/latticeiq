import { useState } from 'react';
import { X } from 'lucide-react';
import type { Contact } from '../types/contact';

const APIURL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

interface ContactDetailModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrichComplete?: () => void;
}

export default function ContactDetailModal({
  contact,
  isOpen,
  onClose,
  onEnrichComplete,
}: ContactDetailModalProps) {
  const [enriching, setEnriching] = useState(false);

  if (!isOpen || !contact) return null;

  const handleEnrich = async () => {
    if (!contact?.id) return;
    
    setEnriching(true);
    try {
      const response = await fetch(
        `${APIURL}/api/v3/enrich/${contact.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) throw new Error('Enrichment failed');

      const result = await response.json();
      console.log('✅ Enrichment result:', result);

      if (onEnrichComplete) {
        onEnrichComplete();
      }
    } catch (error) {
      console.error('❌ Enrichment error:', error);
      alert('Enrichment failed. Please try again.');
    } finally {
      setEnriching(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {contact.first_name} {contact.last_name}
            </h2>
            <p className="text-gray-600 mt-1">{contact.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                contact.enrichment_status
              )}`}
            >
              {contact.enrichment_status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Company" value={contact.company} />
            <DetailRow label="Title" value={contact.title} />
            <DetailRow label="Phone" value={contact.phone} />
            <DetailRow label="Website" value={contact.website} isLink />
            <DetailRow label="LinkedIn" value={contact.linkedin_url} isLink />
            
            {contact.apex_score !== null && (
              <DetailRow
                label="Apex Score"
                value={contact.apex_score?.toString()}
              />
            )}
          </div>

          {contact.enrichment_data ? (
            <div className="space-y-4">
              {contact.enrichment_data.summary && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Summary
                  </h3>
                  <p className="text-gray-600">
                    {contact.enrichment_data.summary}
                  </p>
                </div>
              )}

              {contact.enrichment_data.openingline && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Opening Line
                  </h3>
                  <p className="text-gray-600 italic">
                    "{contact.enrichment_data.openingline}"
                  </p>
                </div>
              )}

              {contact.enrichment_data.talkingpoints &&
                contact.enrichment_data.talkingpoints.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Talking Points
                    </h3>
                    <ul className="list-disc list-inside space-y-1">
                      {contact.enrichment_data.talkingpoints.map(
                        (point: string, idx: number) => (
                          <li key={idx} className="text-gray-600">
                            {point}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

              {contact.enrichment_data.inferredcompanywebsite && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Company Website
                  </h3>
                  <a
                    href={contact.enrichment_data.inferredcompanywebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {contact.enrichment_data.inferredcompanywebsite}
                  </a>
                </div>
              )}

              {(contact.enrichment_data.personatype ||
                contact.enrichment_data.vertical ||
                contact.enrichment_data.inferredtitle ||
                contact.enrichment_data.inferredlocation) && (
                <div className="grid grid-cols-2 gap-4">
                  {contact.enrichment_data.personatype && (
                    <div>
                      <span className="text-sm font-semibold text-gray-700">
                        Persona:{' '}
                      </span>
                      <span className="text-gray-600">
                        {contact.enrichment_data.personatype}
                      </span>
                    </div>
                  )}
                  {contact.enrichment_data.vertical && (
                    <div>
                      <span className="text-sm font-semibold text-gray-700">
                        Vertical:{' '}
                      </span>
                      <span className="text-gray-600">
                        {contact.enrichment_data.vertical}
                      </span>
                    </div>
                  )}
                  {contact.enrichment_data.inferredtitle && (
                    <div>
                      <span className="text-sm font-semibold text-gray-700">
                        Title:{' '}
                      </span>
                      <span className="text-gray-600">
                        {contact.enrichment_data.inferredtitle}
                      </span>
                    </div>
                  )}
                  {contact.enrichment_data.inferredlocation && (
                    <div>
                      <span className="text-sm font-semibold text-gray-700">
                        Location:{' '}
                      </span>
                      <span className="text-gray-600">
                        {contact.enrichment_data.inferredlocation}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">No enrichment data available</p>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={handleEnrich}
            disabled={enriching || contact.enrichment_status === 'processing'}
            className={`px-4 py-2 rounded-md ${
              enriching || contact.enrichment_status === 'processing'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {enriching ? 'Enriching...' : 'Enrich Contact'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  isLink = false,
}: {
  label: string;
  value?: string | null;
  isLink?: boolean;
}) {
  if (!value) return null;

  return (
    <div>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">
        {isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
