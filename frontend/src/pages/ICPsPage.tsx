import { useState, useEffect } from 'react';
import { icpApi, ICP, ContactMatch } from '../api/icps';

export default function ICPsPage() {
  const [icps, setIcps] = useState<ICP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIcp, setSelectedIcp] = useState<ICP | null>(null);
  const [matches, setMatches] = useState<any>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);

  useEffect(() => {
    loadIcps();
  }, []);

  const loadIcps = async () => {
    try {
      const data = await icpApi.list();
      setIcps(data);
    } catch (error) {
      console.error('Failed to load ICPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchContacts = async (icpId: string) => {
    setMatchingLoading(true);
    try {
      await icpApi.matchContacts(icpId, undefined, 40);
      const matchData = await icpApi.getMatches(icpId, 40);
      setMatches(matchData);
      setSelectedIcp(icps.find((i) => i.id === icpId) || null);
    } catch (error) {
      console.error('Failed to match contacts:', error);
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ICP?')) return;
    try {
      await icpApi.delete(id);
      loadIcps();
    } catch (error) {
      console.error('Failed to delete ICP:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading ICPs...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ideal Client Profiles</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Create ICP
        </button>
      </div>

      {icps.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No ICPs yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-blue-600 hover:underline"
          >
            Create your first ICP
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {icps.map((icp) => (
            <ICPCard
              key={icp.id}
              icp={icp}
              onMatch={handleMatchContacts}
              onDelete={handleDelete}
              matchingLoading={matchingLoading}
            />
          ))}
        </div>
      )}

      {matches && selectedIcp && (
        <MatchesPanel
          icp={selectedIcp}
          matches={matches}
          onClose={() => setMatches(null)}
        />
      )}

      {showCreateModal && (
        <CreateICPModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadIcps();
          }}
        />
      )}
    </div>
  );
}

function ICPCard({
  icp,
  onMatch,
  onDelete,
  matchingLoading,
}: {
  icp: ICP;
  onMatch: (id: string) => void;
  onDelete: (id: string) => void;
  matchingLoading: boolean;
}) {
  return (
    <div className="bg-white border rounded-lg p-5 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-lg">{icp.name}</h3>
        <span
          className={`px-2 py-1 rounded text-xs ${
            icp.is_active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {icp.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {icp.description && (
        <p className="text-sm text-gray-600 mb-4">{icp.description}</p>
      )}

      <div className="space-y-2 mb-4">
        <div>
          <span className="text-xs font-medium text-gray-500">Industries:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {icp.criteria.industries.map((ind, i) => (
              <span
                key={i}
                className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
              >
                {ind}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-gray-500">Personas:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {icp.criteria.personas.map((per, i) => (
              <span
                key={i}
                className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded"
              >
                {per}
              </span>
            ))}
          </div>
        </div>

        {icp.criteria.min_company_size && (
          <div>
            <span className="text-xs font-medium text-gray-500">
              Company Size:
            </span>
            <span className="text-sm ml-2">
              {icp.criteria.min_company_size}
              {icp.criteria.max_company_size
                ? `-${icp.criteria.max_company_size}`
                : '+'}{' '}
              employees
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onMatch(icp.id)}
          disabled={matchingLoading}
          className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded hover:bg-blue-100 text-sm font-medium disabled:opacity-50"
        >
          {matchingLoading ? 'Matching...' : 'Match Contacts'}
        </button>
        <button
          onClick={() => onDelete(icp.id)}
          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function MatchesPanel({
  icp,
  matches,
  onClose,
}: {
  icp: ICP;
  matches: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Matches for {icp.name} (Min Score: {matches.min_score})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Found <strong>{matches.total_matches}</strong> matching contacts
          </p>
        </div>

        {matches.contacts.length === 0 ? (
          <p className="text-center py-8 text-gray-500">
            No contacts match this ICP criteria
          </p>
        ) : (
          <div className="space-y-2">
            {matches.contacts.map((contact: any) => (
              <div
                key={contact.id}
                className="border rounded p-3 hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{contact.name}</h4>
                    <p className="text-sm text-gray-600">{contact.job_title}</p>
                    <p className="text-sm text-gray-500">{contact.company}</p>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        contact.icp_match_score >= 70
                          ? 'text-green-600'
                          : contact.icp_match_score >= 40
                          ? 'text-yellow-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {contact.icp_match_score}
                    </div>
                    <div className="text-xs text-gray-500">ICP Score</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateICPModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [industries, setIndustries] = useState('');
  const [personas, setPersonas] = useState('');
  const [minSize, setMinSize] = useState('');
  const [maxSize, setMaxSize] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      await icpApi.create({
        name,
        description: description || undefined,
        criteria: {
          industries: industries.split(',').map((s) => s.trim()).filter(Boolean),
          personas: personas.split(',').map((s) => s.trim()).filter(Boolean),
          min_company_size: minSize ? parseInt(minSize) : undefined,
          max_company_size: maxSize ? parseInt(maxSize) : undefined,
        },
        is_active: true,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to create ICP:', error);
      alert('Failed to create ICP');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Create New ICP</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Tech Decision Makers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={2}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Industries (comma-separated)
            </label>
            <input
              type="text"
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Technology, Finance, SaaS"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Personas (comma-separated)
            </label>
            <input
              type="text"
              value={personas}
              onChange={(e) => setPersonas(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Executive, Manager, Decision-maker"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Min Company Size
              </label>
              <input
                type="number"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., 50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Max Company Size
              </label>
              <input
                type="number"
                value={maxSize}
                onChange={(e) => setMaxSize(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., 5000"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create ICP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
