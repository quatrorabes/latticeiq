import { useState, useEffect } from 'react';
import { icpApi, ICP, ContactMatch } from '../api/icps';
import { Edit2, Trash2, Target, Users, Building2, TrendingUp } from 'lucide-react';

export default function ICPsPage() {
  const [icps, setIcps] = useState<ICP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIcp, setEditingIcp] = useState<ICP | null>(null);
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

  const handleEdit = (icp: ICP) => {
    setEditingIcp(icp);
    setShowModal(true);
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
      <div className="flex justify-center items-center h-screen bg-slate-900">
        <div className="text-slate-400">Loading ICPs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Ideal Client Profiles</h1>
            <p className="text-slate-400">Define and match your target customers</p>
          </div>
          <button
            onClick={() => {
              setEditingIcp(null);
              setShowModal(true);
            }}
            className="bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 transition font-medium flex items-center gap-2"
          >
            <Target className="w-5 h-5" />
            Create ICP
          </button>
        </div>

        {icps.length === 0 ? (
          <div className="text-center py-16 bg-slate-800 rounded-lg border border-slate-700">
            <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">No ICPs yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-primary-400 hover:text-primary-300 font-medium"
            >
              Create your first ICP →
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {icps.map((icp) => (
              <ICPCard
                key={icp.id}
                icp={icp}
                onEdit={handleEdit}
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

        {showModal && (
          <ICPModal
            icp={editingIcp}
            onClose={() => {
              setShowModal(false);
              setEditingIcp(null);
            }}
            onSuccess={() => {
              setShowModal(false);
              setEditingIcp(null);
              loadIcps();
            }}
          />
        )}
      </div>
    </div>
  );
}

function ICPCard({
  icp,
  onEdit,
  onMatch,
  onDelete,
  matchingLoading,
}: {
  icp: ICP;
  onEdit: (icp: ICP) => void;
  onMatch: (id: string) => void;
  onDelete: (id: string) => void;
  matchingLoading: boolean;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-primary-500 transition group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-xl text-white mb-1">{icp.name}</h3>
          <span
            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              icp.is_active
                ? 'bg-green-500/20 text-green-400'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {icp.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(icp)}
            className="p-2 text-slate-400 hover:text-primary-400 hover:bg-slate-700 rounded transition"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(icp.id)}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {icp.description && (
        <p className="text-sm text-slate-400 mb-4">{icp.description}</p>
      )}

      {/* Matching Criteria */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-slate-400">
              Industries ({icp.scoring_weights.industry_weight}% weight)
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {icp.criteria.industries.map((ind, i) => (
              <span
                key={i}
                className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded"
              >
                {ind}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-slate-400">
              Personas ({icp.scoring_weights.persona_weight}% weight)
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {icp.criteria.personas.map((per, i) => (
              <span
                key={i}
                className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded"
              >
                {per}
              </span>
            ))}
          </div>
        </div>

        {icp.criteria.min_company_size && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-slate-400">
                Company Size ({icp.scoring_weights.company_size_weight}% weight)
              </span>
            </div>
            <span className="text-sm text-slate-300">
              {icp.criteria.min_company_size}
              {icp.criteria.max_company_size
                ? `-${icp.criteria.max_company_size}`
                : '+'}{' '}
              employees
            </span>
          </div>
        )}
      </div>

      {/* Scoring Summary */}
      <div className="bg-slate-700/50 rounded p-3 mb-4">
        <div className="text-xs text-slate-400 mb-2">Match Score Calculation:</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>Industry Match</span>
            <span>{icp.scoring_weights.industry_weight} points</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Persona Match</span>
            <span>{icp.scoring_weights.persona_weight} points</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Company Size Match</span>
            <span>{icp.scoring_weights.company_size_weight} points</span>
          </div>
          <div className="flex justify-between font-medium text-white pt-2 border-t border-slate-600">
            <span>Total Possible</span>
            <span>100 points</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onMatch(icp.id)}
        disabled={matchingLoading}
        className="w-full bg-primary-500/20 text-primary-300 px-4 py-3 rounded-lg hover:bg-primary-500/30 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Target className="w-4 h-4" />
        {matchingLoading ? 'Matching...' : 'Match Contacts'}
      </button>
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Matches for {icp.name}</h2>
            <p className="text-slate-400">Minimum score: {matches.min_score}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4 bg-slate-700/50 rounded p-4">
          <p className="text-sm text-slate-300">
            Found <strong className="text-white">{matches.total_matches}</strong> matching contacts
          </p>
        </div>

        {matches.contacts.length === 0 ? (
          <p className="text-center py-12 text-slate-400">
            No contacts match this ICP criteria above score {matches.min_score}
          </p>
        ) : (
          <div className="space-y-3">
            {matches.contacts.map((contact: any) => (
              <div
                key={contact.id}
                className="border border-slate-700 rounded-lg p-4 hover:bg-slate-700/30 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-white mb-1">{contact.name}</h4>
                    <p className="text-sm text-slate-400">{contact.job_title}</p>
                    <p className="text-sm text-slate-500">{contact.company}</p>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold mb-1 ${
                        contact.icp_match_score >= 70
                          ? 'text-green-400'
                          : contact.icp_match_score >= 40
                          ? 'text-yellow-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {contact.icp_match_score}
                    </div>
                    <div className="text-xs text-slate-400">ICP Score</div>
                    <div
                      className={`text-xs font-medium mt-1 px-2 py-1 rounded ${
                        contact.icp_match_score >= 70
                          ? 'bg-green-500/20 text-green-400'
                          : contact.icp_match_score >= 40
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {contact.icp_match_score >= 70
                        ? 'Hot'
                        : contact.icp_match_score >= 40
                        ? 'Warm'
                        : 'Cold'}
                    </div>
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

function ICPModal({
  icp,
  onClose,
  onSuccess,
}: {
  icp: ICP | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(icp?.name || '');
  const [description, setDescription] = useState(icp?.description || '');
  const [industries, setIndustries] = useState(
    icp?.criteria.industries.join(', ') || ''
  );
  const [personas, setPersonas] = useState(
    icp?.criteria.personas.join(', ') || ''
  );
  const [minSize, setMinSize] = useState(
    icp?.criteria.min_company_size?.toString() || ''
  );
  const [maxSize, setMaxSize] = useState(
    icp?.criteria.max_company_size?.toString() || ''
  );
  const [industryWeight, setIndustryWeight] = useState(
    icp?.scoring_weights.industry_weight || 30
  );
  const [personaWeight, setPersonaWeight] = useState(
    icp?.scoring_weights.persona_weight || 40
  );
  const [companySizeWeight, setCompanySizeWeight] = useState(
    icp?.scoring_weights.company_size_weight || 30
  );
  const [saving, setSaving] = useState(false);

  const totalWeight = industryWeight + personaWeight + companySizeWeight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (totalWeight !== 100) {
      alert('Scoring weights must add up to 100%');
      return;
    }

    setSaving(true);

    try {
      const data = {
        name,
        description: description || undefined,
        criteria: {
          industries: industries.split(',').map((s) => s.trim()).filter(Boolean),
          personas: personas.split(',').map((s) => s.trim()).filter(Boolean),
          min_company_size: minSize ? parseInt(minSize) : undefined,
          max_company_size: maxSize ? parseInt(maxSize) : undefined,
        },
        scoring_weights: {
          industry_weight: industryWeight,
          persona_weight: personaWeight,
          company_size_weight: companySizeWeight,
        },
        is_active: true,
      };

      if (icp) {
        await icpApi.update(icp.id, data);
      } else {
        await icpApi.create(data);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save ICP:', error);
      alert('Failed to save ICP');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">
          {icp ? 'Edit ICP' : 'Create New ICP'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
              placeholder="e.g., Tech Decision Makers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
              rows={2}
              placeholder="Optional description"
            />
          </div>

          {/* Criteria */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Matching Criteria</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Industries (comma-separated)
                </label>
                <input
                  type="text"
                  value={industries}
                  onChange={(e) => setIndustries(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                  placeholder="e.g., Technology, Finance, SaaS"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Personas (comma-separated)
                </label>
                <input
                  type="text"
                  value={personas}
                  onChange={(e) => setPersonas(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                  placeholder="e.g., Executive, Manager, Decision-maker"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Min Company Size
                  </label>
                  <input
                    type="number"
                    value={minSize}
                    onChange={(e) => setMinSize(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                    placeholder="e.g., 50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Max Company Size
                  </label>
                  <input
                    type="number"
                    value={maxSize}
                    onChange={(e) => setMaxSize(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                    placeholder="e.g., 5000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Scoring Weights */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              Scoring Weights
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Adjust how much each criterion affects the match score (must total 100%)
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">
                    Industry Weight
                  </label>
                  <span className="text-sm font-bold text-white">
                    {industryWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={industryWeight}
                  onChange={(e) => setIndustryWeight(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">
                    Persona Weight
                  </label>
                  <span className="text-sm font-bold text-white">
                    {personaWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={personaWeight}
                  onChange={(e) => setPersonaWeight(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">
                    Company Size Weight
                  </label>
                  <span className="text-sm font-bold text-white">
                    {companySizeWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={companySizeWeight}
                  onChange={(e) => setCompanySizeWeight(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>

              <div
                className={`text-center p-3 rounded-lg font-medium ${
                  totalWeight === 100
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                Total: {totalWeight}% {totalWeight === 100 ? '✓' : '(must equal 100%)'}
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || totalWeight !== 100}
              className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : icp ? 'Update ICP' : 'Create ICP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
