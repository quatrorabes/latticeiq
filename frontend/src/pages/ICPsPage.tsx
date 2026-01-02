import { useState, useEffect } from 'react';
import { icpApi, ICP } from '../api/icps';
import { Edit2, Trash2, Target, Users, Building2, TrendingUp } from 'lucide-react';
import '../styles/ICPsPage.css';

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
      <div className="icps-page">
        <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
          Loading ICPs...
        </div>
      </div>
    );
  }

  return (
    <div className="icps-page">
      <div className="page-header">
        <div className="header-main">
          <Target size={32} />
          <div>
            <h1>Ideal Client Profiles</h1>
            <p>Define and match your target customers</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingIcp(null);
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Target size={20} />
          Create ICP
        </button>
      </div>

      {icps.length === 0 ? (
        <div className="empty-state">
          <Target size={64} />
          <p>No ICPs yet</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Create your first ICP →
          </button>
        </div>
      ) : (
        <div className="icps-grid">
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
    <div className="icp-card">
      <div className="icp-card-header">
        <div className="icp-card-title">
          <h3>{icp.name}</h3>
          <span className={`status-badge ${icp.is_active ? 'active' : 'inactive'}`}>
            {icp.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="icp-card-actions">
          <button onClick={() => onEdit(icp)} className="icon-btn" title="Edit">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onDelete(icp.id)} className="icon-btn danger" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {icp.description && <p className="icp-description">{icp.description}</p>}

      <div className="criteria-section">
        <div className="criteria-header">
          <Building2 size={16} />
          <span className="criteria-label">
            Industries ({icp.scoring_weights.industry_weight}% weight)
          </span>
        </div>
        <div className="criteria-tags">
          {icp.criteria.industries.map((ind, i) => (
            <span key={i} className="criteria-tag industry">
              {ind}
            </span>
          ))}
        </div>
      </div>

      <div className="criteria-section">
        <div className="criteria-header">
          <Users size={16} />
          <span className="criteria-label">
            Personas ({icp.scoring_weights.persona_weight}% weight)
          </span>
        </div>
        <div className="criteria-tags">
          {icp.criteria.personas.map((per, i) => (
            <span key={i} className="criteria-tag persona">
              {per}
            </span>
          ))}
        </div>
      </div>

      {icp.criteria.min_company_size && (
        <div className="criteria-section">
          <div className="criteria-header">
            <TrendingUp size={16} />
            <span className="criteria-label">
              Company Size ({icp.scoring_weights.company_size_weight}% weight)
            </span>
          </div>
          <p className="criteria-text">
            {icp.criteria.min_company_size}
            {icp.criteria.max_company_size ? `-${icp.criteria.max_company_size}` : '+'} employees
          </p>
        </div>
      )}

      <div className="score-breakdown">
        <div className="score-breakdown-title">Match Score Calculation:</div>
        <div className="score-item">
          <span className="score-label">Industry Match</span>
          <span className="score-value">{icp.scoring_weights.industry_weight} points</span>
        </div>
        <div className="score-item">
          <span className="score-label">Persona Match</span>
          <span className="score-value">{icp.scoring_weights.persona_weight} points</span>
        </div>
        <div className="score-item">
          <span className="score-label">Company Size Match</span>
          <span className="score-value">{icp.scoring_weights.company_size_weight} points</span>
        </div>
        <div className="score-item">
          <span className="score-label">Total Possible</span>
          <span className="score-value">100 points</span>
        </div>
      </div>

      <button
        onClick={() => onMatch(icp.id)}
        disabled={matchingLoading}
        className="match-btn"
      >
        <Target size={16} />
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
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>Matches for {icp.name}</h2>
            <p style={{ color: '#94a3b8', margin: '0.5rem 0 0 0' }}>
              Minimum score: {matches.min_score}
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            ×
          </button>
        </div>

        <div className="matches-panel">
          <p>
            Found <strong>{matches.total_matches}</strong> matching contacts
          </p>
        </div>

        {matches.contacts.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            No contacts match this ICP criteria above score {matches.min_score}
          </p>
        ) : (
          <div className="matches-list">
            {matches.contacts.map((contact: any) => (
              <div key={contact.id} className="match-card">
                <div className="match-card-content">
                  <div className="match-info">
                    <h4>{contact.name}</h4>
                    <p>{contact.job_title}</p>
                    <p>{contact.company}</p>
                  </div>
                  <div className="match-score-display">
                    <div
                      className={`match-score-number ${
                        contact.icp_match_score >= 70
                          ? 'hot'
                          : contact.icp_match_score >= 40
                          ? 'warm'
                          : 'cold'
                      }`}
                    >
                      {contact.icp_match_score}
                    </div>
                    <div className="match-score-label">ICP Score</div>
                    <div
                      className={`match-tier-badge ${
                        contact.icp_match_score >= 70
                          ? 'hot'
                          : contact.icp_match_score >= 40
                          ? 'warm'
                          : 'cold'
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
  const [industries, setIndustries] = useState(icp?.criteria.industries.join(', ') || '');
  const [personas, setPersonas] = useState(icp?.criteria.personas.join(', ') || '');
  const [minSize, setMinSize] = useState(icp?.criteria.min_company_size?.toString() || '');
  const [maxSize, setMaxSize] = useState(icp?.criteria.max_company_size?.toString() || '');
  const [industryWeight, setIndustryWeight] = useState(icp?.scoring_weights.industry_weight || 30);
  const [personaWeight, setPersonaWeight] = useState(icp?.scoring_weights.persona_weight || 40);
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
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{icp ? 'Edit ICP' : 'Create New ICP'}</h2>
          <button onClick={onClose} className="close-btn">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="form-input"
              placeholder="e.g., Tech Decision Makers"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
              rows={2}
              placeholder="Optional description"
            />
          </div>

          <div className="section-divider">
            <h3 className="section-title">Matching Criteria</h3>

            <div className="form-group">
              <label className="form-label">Industries (comma-separated)</label>
              <input
                type="text"
                value={industries}
                onChange={(e) => setIndustries(e.target.value)}
                className="form-input"
                placeholder="e.g., Technology, Finance, SaaS"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Personas (comma-separated)</label>
              <input
                type="text"
                value={personas}
                onChange={(e) => setPersonas(e.target.value)}
                className="form-input"
                placeholder="e.g., Executive, Manager, Decision-maker"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Min Company Size</label>
                <input
                  type="number"
                  value={minSize}
                  onChange={(e) => setMinSize(e.target.value)}
                  className="form-input"
                  placeholder="e.g., 50"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Company Size</label>
                <input
                  type="number"
                  value={maxSize}
                  onChange={(e) => setMaxSize(e.target.value)}
                  className="form-input"
                  placeholder="e.g., 5000"
                />
              </div>
            </div>
          </div>

          <div className="section-divider">
            <h3 className="section-title">Scoring Weights</h3>
            <p className="section-subtitle">
              Adjust how much each criterion affects the match score (must total 100%)
            </p>

            <div className="weight-slider-group">
              <div className="weight-slider-header">
                <span className="weight-slider-label">Industry Weight</span>
                <span className="weight-slider-value">{industryWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={industryWeight}
                onChange={(e) => setIndustryWeight(parseInt(e.target.value))}
                className="weight-slider"
              />
            </div>

            <div className="weight-slider-group">
              <div className="weight-slider-header">
                <span className="weight-slider-label">Persona Weight</span>
                <span className="weight-slider-value">{personaWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={personaWeight}
                onChange={(e) => setPersonaWeight(parseInt(e.target.value))}
                className="weight-slider"
              />
            </div>

            <div className="weight-slider-group">
              <div className="weight-slider-header">
                <span className="weight-slider-label">Company Size Weight</span>
                <span className="weight-slider-value">{companySizeWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={companySizeWeight}
                onChange={(e) => setCompanySizeWeight(parseInt(e.target.value))}
                className="weight-slider"
              />
            </div>

            <div className={`weight-total ${totalWeight === 100 ? 'valid' : 'invalid'}`}>
              Total: {totalWeight}% {totalWeight === 100 ? '✓' : '(must equal 100%)'}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || totalWeight !== 100}
              className="btn-primary"
            >
              {saving ? 'Saving...' : icp ? 'Update ICP' : 'Create ICP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
