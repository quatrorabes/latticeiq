// frontend/src/components/QuickScoreModal.tsx
import { useState } from 'react';
import { X, Zap, Target, Building2, Briefcase, Info } from 'lucide-react';
import { Contact } from '../types';

interface QuickScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onScoreComplete: (scoredContacts: Contact[]) => void;
}

interface ScoreCriteria {
  targetTitles: string;
  targetKeywords: string;
  targetIndustries: string;
  prioritizeEmail: boolean;
  prioritizePhone: boolean;
  prioritizeEnriched: boolean;
}

export default function QuickScoreModal({ 
  isOpen, 
  onClose, 
  contacts, 
  onScoreComplete 
}: QuickScoreModalProps) {
  const [criteria, setCriteria] = useState<ScoreCriteria>({
    targetTitles: '',
    targetKeywords: '',
    targetIndustries: '',
    prioritizeEmail: true,
    prioritizePhone: true,
    prioritizeEnriched: true,
  });

  const [isScoring, setIsScoring] = useState(false);

  // Preset templates for common use cases
  const presets = {
    sba_bankers: {
      name: 'SBA Bankers',
      targetTitles: 'SBA Loan Officer, SBA Specialist, SBA Manager, Commercial Lender, Business Banker, VP Commercial Lending, AVP, SVP',
      targetKeywords: 'SBA, small business, lending, loan, bank, credit union, commercial',
      targetIndustries: 'Banking, Financial Services, Credit Union',
    },
    decision_makers: {
      name: 'Decision Makers',
      targetTitles: 'CEO, CFO, CTO, COO, President, Owner, Founder, VP, Director, Head of',
      targetKeywords: '',
      targetIndustries: '',
    },
    sales_leaders: {
      name: 'Sales Leaders',
      targetTitles: 'VP Sales, Sales Director, Head of Sales, Chief Revenue Officer, CRO, Sales Manager, Regional Sales',
      targetKeywords: 'sales, revenue, growth, business development',
      targetIndustries: '',
    },
    marketing: {
      name: 'Marketing Leaders',
      targetTitles: 'CMO, VP Marketing, Marketing Director, Head of Marketing, Growth, Demand Gen',
      targetKeywords: 'marketing, brand, digital, content, demand',
      targetIndustries: '',
    },
    it_tech: {
      name: 'IT/Tech Decision Makers',
      targetTitles: 'CTO, CIO, VP Engineering, IT Director, Head of IT, Tech Lead, Engineering Manager',
      targetKeywords: 'technology, software, infrastructure, cloud, security',
      targetIndustries: 'Technology, Software, SaaS',
    },
  };

  const applyPreset = (presetKey: keyof typeof presets) => {
    const preset = presets[presetKey];
    setCriteria({
      ...criteria,
      targetTitles: preset.targetTitles,
      targetKeywords: preset.targetKeywords,
      targetIndustries: preset.targetIndustries,
    });
  };

  const calculateQuickScore = (contact: Contact): number => {
    let score = 0;
    const maxScore = 100;

    // Parse criteria into arrays (lowercase for comparison)
    const titles = criteria.targetTitles
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const keywords = criteria.targetKeywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    const industries = criteria.targetIndustries
      .split(',')
      .map(i => i.trim().toLowerCase())
      .filter(i => i.length > 0);

    const contactTitle = (contact.title || '').toLowerCase();
    const contactCompany = (contact.company || '').toLowerCase();
    const contactIndustry = (contact.industry || '').toLowerCase();

    // Title matching (up to 35 points)
    if (titles.length > 0) {
      // Exact match
      const exactMatch = titles.some(t => contactTitle === t);
      if (exactMatch) {
        score += 35;
      } else {
        // Partial match - check if any target title words appear
        const titleMatches = titles.filter(t => 
          contactTitle.includes(t) || t.split(' ').some(word => contactTitle.includes(word))
        );
        if (titleMatches.length > 0) {
          score += Math.min(25, titleMatches.length * 15);
        }
      }
    }

    // Keyword matching (up to 30 points)
    if (keywords.length > 0) {
      const searchText = `${contactTitle} ${contactCompany} ${contactIndustry}`.toLowerCase();
      const matchedKeywords = keywords.filter(k => searchText.includes(k));
      score += Math.min(30, matchedKeywords.length * 10);
    }

    // Industry matching (up to 20 points)
    if (industries.length > 0 && contactIndustry) {
      const industryMatch = industries.some(i => 
        contactIndustry.includes(i) || i.includes(contactIndustry)
      );
      if (industryMatch) {
        score += 20;
      }
    }

    // Bonus points for contact quality
    if (criteria.prioritizeEmail && contact.email) {
      score += 8;
    }
    if (criteria.prioritizePhone && contact.phone) {
      score += 4;
    }
    if (criteria.prioritizeEnriched && contact.enrichment_status === 'completed') {
      score += 3;
    }

    // Normalize to 0-100
    return Math.min(maxScore, Math.round(score));
  };

  const handleScore = () => {
    setIsScoring(true);

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const scoredContacts = contacts.map(contact => ({
        ...contact,
        quick_score: calculateQuickScore(contact),
      }));

      // Sort by quick_score descending
      scoredContacts.sort((a, b) => (b.quick_score || 0) - (a.quick_score || 0));

      onScoreComplete(scoredContacts);
      setIsScoring(false);
      onClose();
    }, 100);
  };

  if (!isOpen) return null;

  const styles = {
    overlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(4px)',
    },
    modal: {
      background: '#1e293b',
      borderRadius: '16px',
      width: '90%',
      maxWidth: '600px',
      maxHeight: '90vh',
      overflow: 'auto',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1.5rem',
      borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
    },
    headerTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: '#f8fafc',
      fontSize: '1.25rem',
      fontWeight: 700,
      margin: 0,
    },
    closeBtn: {
      background: 'transparent',
      border: 'none',
      color: '#94a3b8',
      cursor: 'pointer',
      padding: '0.5rem',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: '1.5rem',
    },
    section: {
      marginBottom: '1.5rem',
    },
    sectionTitle: {
      color: '#94a3b8',
      fontSize: '0.75rem',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      marginBottom: '0.75rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    presetGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: '0.5rem',
      marginBottom: '1rem',
    },
    presetBtn: {
      padding: '0.6rem 0.8rem',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '8px',
      color: '#f8fafc',
      fontSize: '0.85rem',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      textAlign: 'center' as const,
    },
    inputGroup: {
      marginBottom: '1rem',
    },
    label: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: '#e2e8f0',
      fontSize: '0.9rem',
      fontWeight: 600,
      marginBottom: '0.5rem',
    },
    input: {
      width: '100%',
      padding: '0.75rem 1rem',
      background: '#0f172a',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: '10px',
      color: '#f8fafc',
      fontSize: '0.9rem',
      outline: 'none',
    },
    textarea: {
      width: '100%',
      padding: '0.75rem 1rem',
      background: '#0f172a',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: '10px',
      color: '#f8fafc',
      fontSize: '0.9rem',
      outline: 'none',
      minHeight: '80px',
      resize: 'vertical' as const,
      fontFamily: 'inherit',
    },
    hint: {
      color: '#64748b',
      fontSize: '0.8rem',
      marginTop: '0.25rem',
    },
    checkboxGroup: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '1rem',
    },
    checkboxLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: '#e2e8f0',
      fontSize: '0.9rem',
      cursor: 'pointer',
    },
    checkbox: {
      width: '18px',
      height: '18px',
      accentColor: '#6366f1',
      cursor: 'pointer',
    },
    infoBox: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '1rem',
      background: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      borderRadius: '10px',
      marginBottom: '1.5rem',
    },
    infoText: {
      color: '#94a3b8',
      fontSize: '0.85rem',
      lineHeight: 1.5,
      margin: 0,
    },
    footer: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.75rem',
      padding: '1.5rem',
      borderTop: '1px solid rgba(148, 163, 184, 0.1)',
    },
    btnCancel: {
      padding: '0.75rem 1.5rem',
      background: 'rgba(148, 163, 184, 0.1)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '10px',
      color: '#f8fafc',
      fontSize: '0.9rem',
      fontWeight: 600,
      cursor: 'pointer',
    },
    btnScore: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      border: 'none',
      borderRadius: '10px',
      color: 'white',
      fontSize: '0.9rem',
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
    },
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>
            <Zap size={24} style={{ color: '#f59e0b' }} />
            Quick Score
          </h2>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div style={styles.content}>
          <div style={styles.infoBox}>
            <Info size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
            <p style={styles.infoText}>
              Quick Score instantly ranks your {contacts.length} contacts based on your criteria.
              No API calls - runs entirely in your browser for instant results.
            </p>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Target size={14} />
              Presets
            </div>
            <div style={styles.presetGrid}>
              {Object.entries(presets).map(([key, preset]) => (
                <button
                  key={key}
                  style={styles.presetBtn}
                  onClick={() => applyPreset(key as keyof typeof presets)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                    e.currentTarget.style.borderColor = '#6366f1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Briefcase size={14} />
              Target Criteria
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Target Titles</label>
              <textarea
                style={styles.textarea}
                placeholder="e.g., SBA Loan Officer, VP Commercial Lending, Business Banker"
                value={criteria.targetTitles}
                onChange={(e) => setCriteria({ ...criteria, targetTitles: e.target.value })}
              />
              <p style={styles.hint}>Comma-separated. Matches +35pts exact, +15pts partial</p>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Keywords</label>
              <textarea
                style={styles.textarea}
                placeholder="e.g., SBA, lending, loan, commercial banking"
                value={criteria.targetKeywords}
                onChange={(e) => setCriteria({ ...criteria, targetKeywords: e.target.value })}
              />
              <p style={styles.hint}>Comma-separated. Searches title, company, industry. +10pts each</p>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>
                <Building2 size={16} />
                Target Industries
              </label>
              <input
                type="text"
                style={styles.input}
                placeholder="e.g., Banking, Financial Services, Credit Union"
                value={criteria.targetIndustries}
                onChange={(e) => setCriteria({ ...criteria, targetIndustries: e.target.value })}
              />
              <p style={styles.hint}>Comma-separated. +20pts for match</p>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Bonus Points</div>
            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={criteria.prioritizeEmail}
                  onChange={(e) => setCriteria({ ...criteria, prioritizeEmail: e.target.checked })}
                />
                Has Email (+8pts)
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={criteria.prioritizePhone}
                  onChange={(e) => setCriteria({ ...criteria, prioritizePhone: e.target.checked })}
                />
                Has Phone (+4pts)
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={criteria.prioritizeEnriched}
                  onChange={(e) => setCriteria({ ...criteria, prioritizeEnriched: e.target.checked })}
                />
                Enriched (+3pts)
              </label>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.btnCancel} onClick={onClose}>
            Cancel
          </button>
          <button 
            style={styles.btnScore} 
            onClick={handleScore}
            disabled={isScoring}
          >
            <Zap size={18} />
            {isScoring ? 'Scoring...' : `Score ${contacts.length} Contacts`}
          </button>
        </div>
      </div>
    </div>
  );
}
