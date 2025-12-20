import type { Contact } from '../types/contact';
import { X, Zap, Mail, Phone, Building, Briefcase } from 'lucide-react';

interface ContactDetailModalProps {
  contact: Contact;
  onClose: () => void;
  onEnrich: () => void;
}

export default function ContactDetailModal({
  contact,
  onClose,
  onEnrich,
}: ContactDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-700/30 sticky top-0">
          <h2 className="text-xl font-bold text-white">
            {contact.first_name} {contact.last_name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Contact info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contact.email && (
              <div className="flex items-start gap-3">
                <Mail className="text-blue-400 mt-1" size={20} />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
                  <p className="text-white font-medium break-all">{contact.email}</p>
                </div>
              </div>
            )}

            {contact.phone && (
              <div className="flex items-start gap-3">
                <Phone className="text-green-400 mt-1" size={20} />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Phone</p>
                  <p className="text-white font-medium">{contact.phone}</p>
                </div>
              </div>
            )}

            {contact.company && (
              <div className="flex items-start gap-3">
                <Building className="text-purple-400 mt-1" size={20} />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Company</p>
                  <p className="text-white font-medium">{contact.company}</p>
                </div>
              </div>
            )}

            {contact.title && (
              <div className="flex items-start gap-3">
                <Briefcase className="text-orange-400 mt-1" size={20} />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Title</p>
                  <p className="text-white font-medium">{contact.title}</p>
                </div>
              </div>
            )}
          </div>

          {/* Enrichment status */}
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Enrichment Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    contact.enrichment_status === 'completed'
                      ? 'bg-green-500/20 text-green-200'
                      : contact.enrichment_status === 'processing'
                      ? 'bg-blue-500/20 text-blue-200'
                      : 'bg-yellow-500/20 text-yellow-200'
                  }`}
                >
                  {contact.enrichment_status || 'pending'}
                </span>
              </div>

              {contact.apex_score && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">APEX Score:</span>
                  <span
                    className={`font-semibold ${
                      contact.apex_score >= 75
                        ? 'text-green-400'
                        : contact.apex_score >= 50
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    }`}
                  >
                    {Math.round(contact.apex_score)}/100
                  </span>
                </div>
              )}

              {contact.mdc_score && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">MDC Score:</span>
                  <span className="font-semibold text-blue-400">
                    {Math.round(contact.mdc_score)}/100
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Enrichment data preview */}
          {contact.enrichment_data && (
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Enrichment Data</h3>
              <pre className="text-xs text-gray-300 bg-gray-900 p-3 rounded overflow-x-auto max-h-48">
                {JSON.stringify(contact.enrichment_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Notes</h3>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-700 bg-gray-700/30 sticky bottom-0">
          {contact.enrichment_status !== 'completed' && (
            <button
              onClick={onEnrich}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              <Zap size={18} />
              Start Enrichment
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}