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
  parsed_profile?: any;
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
  const [activeTab, setActiveTab] = useState<'profile' | 'raw'>('profile');

  if (!isOpen || !contact) return null;

  const profile = contact.parsed_profile || {};
  const enrichment = contact.enrichment_data || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-900">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {contact.first_name} {contact.last_name}
            </h2>
            <p className="text-sm text-gray-400">{contact.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-800">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-center font-medium transition ${
              activeTab === 'profile'
                ? 'border-b-2 border-purple-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`flex-1 py-3 text-center font-medium transition ${
              activeTab === 'raw'
                ? 'border-b-2 border-purple-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Raw Data
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {activeTab === 'profile' ? (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase">APEX Score</p>
                  <p className="text-2xl font-bold text-green-400">{contact.apex_score ?? '-'}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase">Status</p>
                  <p className="text-sm font-medium text-blue-400">{contact.enrichment_status}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase">Title</p>
                  <p className="text-sm font-medium text-white">{contact.title || '-'}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-xs text-gray-400 uppercase">Company</p>
                  <p className="text-sm font-medium text-white">{contact.company || '-'}</p>
                </div>
              </div>

              {/* Profile Summary */}
              {profile.summary && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">SUMMARY</h3>
                  <p className="text-sm text-gray-300">{profile.summary}</p>
                </div>
              )}

              {/* Opening Line */}
              {profile.opening_line && (
                <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-purple-600">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">💬 OPENING LINE</h3>
                  <p className="text-sm text-gray-200 italic">"{profile.opening_line}"</p>
                </div>
              )}

              {/* Hook */}
              {profile.hook_angle && (
                <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-yellow-600">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">🎣 BEST HOOK</h3>
                  <p className="text-sm text-gray-200">{profile.hook_angle}</p>
                </div>
              )}

              {/* Why Now */}
              {profile.why_buy_now && (
                <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-green-600">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">⏰ WHY NOW?</h3>
                  <p className="text-sm text-gray-200">{profile.why_buy_now}</p>
                </div>
              )}

              {/* Talking Points */}
              {profile.talking_points?.length > 0 && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">💡 TALKING POINTS</h3>
                  <ul className="space-y-2">
                    {profile.talking_points.map((point: string, i: number) => (
                      <li key={i} className="text-sm text-gray-300 flex gap-2">
                        <span className="text-purple-400">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* BANT Scores */}
              {profile.bant && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">📊 BANT FRAMEWORK</h3>
                  <div className="space-y-2">
                    {Object.entries(profile.bant).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-gray-400 capitalize">{key}</span>
                        <span className="text-sm font-medium text-gray-300">{val ?? '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Company Info */}
              {Object.keys(profile.company || {}).length > 0 && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">🏢 COMPANY</h3>
                  <div className="space-y-2">
                    {Object.entries(profile.company).map(([key, val]: [string, any]) => (
                      <div key={key}>
                        <p className="text-xs text-gray-500 uppercase">{key}</p>
                        <p className="text-sm text-gray-300">{val || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Objection Handlers */}
              {Object.keys(profile.objection_handlers || {}).length > 0 && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">🛡️ HANDLE OBJECTIONS</h3>
                  <div className="space-y-2">
                    {Object.entries(profile.objection_handlers).map(([objection, handler]: [string, any]) => (
                      <div key={objection} className="border-l-2 border-red-600 pl-3">
                        <p className="text-sm font-medium text-red-400">{objection}</p>
                        <p className="text-sm text-gray-300">{handler}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Raw Data Tab */
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">RAW ENRICHMENT DATA</h3>
                <pre className="bg-gray-900 p-3 rounded text-xs text-gray-300 overflow-x-auto max-h-96">
                  {JSON.stringify(enrichment, null, 2)}
                </pre>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(enrichment, null, 2));
                  alert('Copied to clipboard!');
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium text-sm"
              >
                📋 Copy Raw Data
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactDetailModal;
