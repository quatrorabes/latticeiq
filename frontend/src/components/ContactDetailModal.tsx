/**
 * ContactDetailModal.tsx - PREMIUM VERSION
 * Modern glassmorphism design with full enrichment integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Contact } from '../types';

interface ContactDetailModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onEnrich?: (contactId: string) => Promise<void>;
  onUpdate?: (contact: Contact) => void;
}

type TabType = 'overview' | 'enrichment' | 'scoring' | 'activity';

// Quick enrich data structure from our API
interface QuickEnrichData {
  summary?: string;
  opening_line?: string;
  persona_type?: string;
  vertical?: string;
  inferred_title?: string;
  inferred_company_website?: string;
  inferred_location?: string;
  talking_points?: string[];
}

interface EnrichmentDataStructure {
  quick_enrich?: QuickEnrichData;
  provider?: string;
  model?: string;
  generated_at?: string;
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
    animation: 'fadeIn 0.2s ease-out',
  },
  modal: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.3s ease-out',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '28px 32px',
    position: 'relative',
    overflow: 'hidden',
  },
  headerPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  headerContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatar: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: '700',
    color: 'white',
    marginRight: '20px',
    border: '3px solid rgba(255, 255, 255, 0.3)',
    flexShrink: 0,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: '26px',
    fontWeight: '700',
    color: 'white',
    margin: 0,
    marginBottom: '4px',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: '15px',
    color: 'rgba(255, 255, 255, 0.85)',
    margin: 0,
    marginBottom: '8px',
  },
  company: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.15)',
    border: 'none',
    color: 'white',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    zIndex: 10,
  },
  quickStats: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
  quickStat: {
    background: 'rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(4px)',
  },
  quickStatLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  quickStatValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'white',
  },
  tabs: {
    display: 'flex',
    background: 'rgba(0, 0, 0, 0.3)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    padding: '16px 20px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    position: 'relative',
  },
  tabActive: {
    color: 'white',
    background: 'rgba(102, 126, 234, 0.2)',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #667eea, #764ba2)',
    borderRadius: '3px 3px 0 0',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '24px 32px',
  },
  section: {
    marginBottom: '28px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  infoCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  infoLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  infoValue: {
    fontSize: '15px',
    color: 'white',
    fontWeight: '500',
    wordBreak: 'break-word' as const,
  },
  infoLink: {
    fontSize: '15px',
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '500',
  },
  enrichmentBanner: {
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center' as const,
    border: '1px solid rgba(102, 126, 234, 0.3)',
    marginBottom: '24px',
  },
  enrichBtn: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 32px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  enrichBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  enrichmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  enrichmentCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  enrichmentCardFull: {
    gridColumn: '1 / -1',
  },
  enrichmentCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  enrichmentCardIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  enrichmentCardTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    margin: 0,
  },
  enrichmentCardValue: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 1.6,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  },
  badgeDecisionMaker: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  badgeChampion: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: '#fbbf24',
    border: '1px solid rgba(251, 191, 36, 0.3)',
  },
  badgeInfluencer: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  badgeDefault: {
    background: 'rgba(156, 163, 175, 0.2)',
    color: '#9ca3af',
    border: '1px solid rgba(156, 163, 175, 0.3)',
  },
  scoreGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '24px',
  },
  scoreCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '20px',
    padding: '24px',
    textAlign: 'center' as const,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  scoreCardGlow: {
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  scoreLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '16px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  scoreCircle: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    margin: '0 auto 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scoreValue: {
    fontSize: '32px',
    fontWeight: '800',
    color: 'white',
    position: 'relative',
    zIndex: 1,
  },
  scoreTier: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  tierHot: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  tierWarm: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: '#fbbf24',
    border: '1px solid rgba(251, 191, 36, 0.3)',
  },
  tierCold: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  overallScore: {
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
    borderRadius: '20px',
    padding: '28px',
    textAlign: 'center' as const,
    border: '1px solid rgba(102, 126, 234, 0.3)',
  },
  overallLabel: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '8px',
  },
  overallValue: {
    fontSize: '48px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  activityTimeline: {
    position: 'relative',
    paddingLeft: '32px',
  },
  activityLine: {
    position: 'absolute',
    left: '11px',
    top: '8px',
    bottom: '8px',
    width: '2px',
    background: 'rgba(255, 255, 255, 0.1)',
  },
  activityItem: {
    position: 'relative',
    marginBottom: '24px',
  },
  activityDot: {
    position: 'absolute',
    left: '-28px',
    top: '4px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#667eea',
    border: '3px solid #1a1a2e',
  },
  activityContent: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  activityTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '4px',
  },
  activityDesc: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: '8px',
  },
  activityTime: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  footer: {
    padding: '20px 32px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerMeta: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  footerActions: {
    display: 'flex',
    gap: '12px',
  },
  btnSecondary: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '10px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
  },
  progressContainer: {
    marginTop: '16px',
  },
  progressBar: {
    height: '6px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea, #764ba2)',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center' as const,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  statusCompleted: {
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80',
    border: '1px solid rgba(34, 197, 94, 0.3)',
  },
  statusPending: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: '#fbbf24',
    border: '1px solid rgba(251, 191, 36, 0.3)',
  },
  statusProcessing: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  statusFailed: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  talkingPoints: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  talkingPoint: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '12px',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 1.5,
  },
  talkingPointIcon: {
    color: '#667eea',
    marginTop: '2px',
    flexShrink: 0,
  },
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#f87171',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorDismiss: {
    background: 'transparent',
    border: 'none',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '18px',
  },
  editInput: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
  },
};

const injectStyles = () => {
  const styleId = 'contact-modal-animations';
  if (document.getElementById(styleId)) return;
  
  const styleSheet = document.createElement('style');
  styleSheet.id = styleId;
  styleSheet.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
};

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  contact,
  isOpen,
  onClose,
  onEnrich,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editData, setEditData] = useState<Contact>(contact);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    setEditData(contact);
    setError(null);
    setActiveTab('overview');
  }, [contact]);

  useEffect(() => {
    if (isEnriching) {
      const interval = setInterval(() => {
        setEnrichProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 500);
      return () => clearInterval(interval);
    } else {
      setEnrichProgress(0);
    }
  }, [isEnriching]);

  const handleEnrich = useCallback(async () => {
    try {
      setIsEnriching(true);
      setError(null);
      setEnrichProgress(0);
      
      const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
      const { getAuthToken } = await import('../api/contacts');
      const token = await getAuthToken();
      
      const response = await fetch(`${API_BASE}/api/v3/enrichment/quick-enrich/${contact.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Enrichment failed: ${response.status}`);
      }

      setEnrichProgress(100);
      
      if (onEnrich) {
        await onEnrich(contact.id);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrich contact');
    } finally {
      setIsEnriching(false);
    }
  }, [contact.id, onEnrich]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setError(null);
      
      const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
      const { getAuthToken } = await import('../api/contacts');
      const token = await getAuthToken();
      
      const response = await fetch(`${API_BASE}/api/v3/contacts/${editData.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          first_name: editData.first_name,
          last_name: editData.last_name,
          email: editData.email,
          company: editData.company,
          phone: editData.phone,
          title: editData.title,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      const updated = await response.json();
      onUpdate?.(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  }, [editData, onUpdate]);

  if (!isOpen) return null;

  // Parse enrichment data with proper structure
  const enrichmentRaw = contact.enrichment_data as EnrichmentDataStructure | undefined;
  const quickEnrich = enrichmentRaw?.quick_enrich || {};
  const hasEnrichment = contact.enrichment_status === 'completed' && Object.keys(quickEnrich).length > 0;
  
  const getInitials = () => {
    return `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase() || '?';
  };

  const getTierStyle = (tier?: string) => {
    if (!tier) return styles.tierCold;
    const t = tier.toLowerCase();
    if (t === 'hot') return styles.tierHot;
    if (t === 'warm') return styles.tierWarm;
    return styles.tierCold;
  };

  const getScoreColor = (score?: number) => {
    if (!score) return '#60a5fa';
    if (score >= 71) return '#f87171';
    if (score >= 40) return '#fbbf24';
    return '#60a5fa';
  };

  const getStatusStyle = () => {
    switch (contact.enrichment_status) {
      case 'completed': return styles.statusCompleted;
      case 'processing': return styles.statusProcessing;
      case 'failed': return styles.statusFailed;
      default: return styles.statusPending;
    }
  };

  const getStatusText = () => {
    switch (contact.enrichment_status) {
      case 'completed': return '✓ Enriched';
      case 'processing': return '⟳ Processing';
      case 'failed': return '✕ Failed';
      default: return '○ Not Enriched';
    }
  };

  const getPersonaBadgeStyle = (persona?: string) => {
    if (!persona) return styles.badgeDefault;
    const p = persona.toLowerCase();
    if (p.includes('decision')) return styles.badgeDecisionMaker;
    if (p.includes('champion')) return styles.badgeChampion;
    if (p.includes('influencer')) return styles.badgeInfluencer;
    return styles.badgeDefault;
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '👤' },
    { id: 'enrichment', label: 'Enrichment', icon: '✨' },
    { id: 'scoring', label: 'Scores', icon: '📊' },
    { id: 'activity', label: 'Activity', icon: '📋' },
  ];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerPattern} />
          <button 
            style={styles.closeBtn} 
            onClick={onClose}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
            onMouseOut={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
          >
            ✕
          </button>
          <div style={styles.headerContent}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={styles.avatar}>{getInitials()}</div>
              <div style={styles.headerInfo}>
                <h2 style={styles.name}>
                  {contact.first_name} {contact.last_name}
                </h2>
                {(contact.title || quickEnrich.inferred_title) && (
                  <p style={styles.title}>{contact.title || quickEnrich.inferred_title}</p>
                )}
                <p style={styles.company}>
                  <span>🏢</span> {contact.company || 'No company'}
                </p>
              </div>
            </div>
          </div>
          <div style={styles.quickStats}>
            <div style={styles.quickStat}>
              <span style={styles.quickStatLabel}>MDCP</span>
              <span style={{...styles.quickStatValue, color: getScoreColor(contact.mdcp_score)}}>
                {contact.mdcp_score || '—'}
              </span>
            </div>
            <div style={styles.quickStat}>
              <span style={styles.quickStatLabel}>Status</span>
              <span style={{...styles.statusBadge, ...getStatusStyle()}}>
                {getStatusText()}
              </span>
            </div>
            {quickEnrich.persona_type && (
              <div style={styles.quickStat}>
                <span style={styles.quickStatLabel}>Persona</span>
                <span style={{...styles.badge, ...getPersonaBadgeStyle(quickEnrich.persona_type)}}>
                  {quickEnrich.persona_type}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && <div style={styles.tabIndicator} />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={styles.body}>
          {error && (
            <div style={styles.errorBanner}>
              <span style={styles.errorText}>
                <span>⚠️</span> {error}
              </span>
              <button style={styles.errorDismiss} onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>
                  <span>📧</span> Contact Information
                </h3>
                <div style={styles.infoGrid}>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Email</div>
                    {isEditing ? (
                      <input
                        style={styles.editInput}
                        type="email"
                        value={editData.email}
                        onChange={e => setEditData({...editData, email: e.target.value})}
                      />
                    ) : (
                      <a href={`mailto:${contact.email}`} style={styles.infoLink}>
                        {contact.email}
                      </a>
                    )}
                  </div>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Phone</div>
                    {isEditing ? (
                      <input
                        style={styles.editInput}
                        type="tel"
                        value={editData.phone || ''}
                        onChange={e => setEditData({...editData, phone: e.target.value})}
                      />
                    ) : (
                      <div style={styles.infoValue}>{contact.phone || '—'}</div>
                    )}
                  </div>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Company</div>
                    {isEditing ? (
                      <input
                        style={styles.editInput}
                        type="text"
                        value={editData.company || ''}
                        onChange={e => setEditData({...editData, company: e.target.value})}
                      />
                    ) : (
                      <div style={styles.infoValue}>{contact.company || '—'}</div>
                    )}
                  </div>
                  <div style={styles.infoCard}>
                    <div style={styles.infoLabel}>Title</div>
                    {isEditing ? (
                      <input
                        style={styles.editInput}
                        type="text"
                        value={editData.title || ''}
                        onChange={e => setEditData({...editData, title: e.target.value})}
                      />
                    ) : (
                      <div style={styles.infoValue}>{contact.title || quickEnrich.inferred_title || '—'}</div>
                    )}
                  </div>
                </div>
              </div>

              {hasEnrichment && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>
                    <span>🎯</span> AI Summary
                  </h3>
                  <div style={{...styles.enrichmentCard, ...styles.enrichmentCardFull}}>
                    <div style={styles.enrichmentCardValue}>{quickEnrich.summary}</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <>
              {!hasEnrichment ? (
                <div style={styles.enrichmentBanner}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
                  <h3 style={{ color: 'white', margin: '0 0 8px', fontSize: '20px' }}>
                    Unlock Contact Intelligence
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 20px', fontSize: '14px' }}>
                    Enrich this contact to get AI-powered insights, talking points, and personalized openers.
                  </p>
                  <button
                    style={{
                      ...styles.enrichBtn,
                      ...(isEnriching ? styles.enrichBtnDisabled : {}),
                    }}
                    onClick={handleEnrich}
                    disabled={isEnriching}
                  >
                    {isEnriching ? (
                      <>
                        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                        Enriching...
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        Enrich Now
                      </>
                    )}
                  </button>
                  {isEnriching && (
                    <div style={styles.progressContainer}>
                      <div style={styles.progressBar}>
                        <div style={{...styles.progressFill, width: `${enrichProgress}%`}} />
                      </div>
                      <div style={styles.progressText}>
                        Gathering intelligence... {Math.round(enrichProgress)}%
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={styles.enrichmentGrid}>
                  {/* Summary */}
                  {quickEnrich.summary && (
                    <div style={{...styles.enrichmentCard, ...styles.enrichmentCardFull}}>
                      <div style={styles.enrichmentCardHeader}>
                        <div style={styles.enrichmentCardIcon}>📝</div>
                        <h4 style={styles.enrichmentCardTitle}>AI Summary</h4>
                      </div>
                      <div style={styles.enrichmentCardValue}>{quickEnrich.summary}</div>
                    </div>
                  )}
                  
                  {/* Opening Line */}
                  {quickEnrich.opening_line && (
                    <div style={{...styles.enrichmentCard, ...styles.enrichmentCardFull}}>
                      <div style={styles.enrichmentCardHeader}>
                        <div style={styles.enrichmentCardIcon}>💬</div>
                        <h4 style={styles.enrichmentCardTitle}>Personalized Opener</h4>
                      </div>
                      <div style={{...styles.enrichmentCardValue, fontStyle: 'italic', color: '#a5b4fc'}}>
                        "{quickEnrich.opening_line}"
                      </div>
                    </div>
                  )}

                  {/* Persona & Vertical */}
                  {quickEnrich.persona_type && (
                    <div style={styles.enrichmentCard}>
                      <div style={styles.enrichmentCardHeader}>
                        <div style={styles.enrichmentCardIcon}>👤</div>
                        <h4 style={styles.enrichmentCardTitle}>Persona Type</h4>
                      </div>
                      <span style={{...styles.badge, ...getPersonaBadgeStyle(quickEnrich.persona_type)}}>
                        {quickEnrich.persona_type}
                      </span>
                    </div>
                  )}
                  
                  {quickEnrich.vertical && (
                    <div style={styles.enrichmentCard}>
                      <div style={styles.enrichmentCardHeader}>
                        <div style={styles.enrichmentCardIcon}>🏭</div>
                        <h4 style={styles.enrichmentCardTitle}>Vertical</h4>
                      </div>
                      <div style={styles.enrichmentCardValue}>{quickEnrich.vertical}</div>
                    </div>
                  )}

                  {/* Inferred Data */}
                  {quickEnrich.inferred_title && (
                    <div style={styles.enrichmentCard}>
                      <div style={styles.enrichmentCardHeader}>
                        <div style={styles.enrichmentCardIcon}>💼</div>
                        <h4 style={styles.enrichmentCardTitle}>Inferred Title</h4>
                      </div>
                      <div style={styles.enrichmentCardValue}>{quickEnrich.inferred_title}</div>
                    </div>
                  )}
                  
                  {quickEnrich.inferred_location && (
                    <div style={styles.enrichmentCard}>
                      <div style={styles.enrichmentCardHeader}>
                        <div style={styles.enrichmentCardIcon}>📍</div>
                        <h4 style={styles.enrichmentCardTitle}>Location</h4>
                      </div>
                      <div style={styles.enrichmentCardValue}>{quickEnrich.inferred_location}</div>
                    </div>
                  )}

                  {quickEnrich.inferred_company_website && (
                    <div style={styles.enrichmentCard}>
                      <div style={styles.enrichmentCardHeader}>
                        <div style={styles.enrichmentCardIcon}>🌐</div>
                        <h4 style={styles.enrichmentCardTitle}>Company Website</h4>
                      </div>
                      <a 
                        href={quickEnrich.inferred_company_website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={styles.infoLink}
                      >
                        {quickEnrich.inferred_company_website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  
                  {/* Talking Points */}
                  {quickEnrich.talking_points && quickEnrich.talking_points.length > 0 && (
                    <div style={{...styles.enrichmentCard, ...styles.enrichmentCardFull}}>
                      <div style={styles.enrichmentCardHeader}>
                        <div style={styles.enrichmentCardIcon}>🎯</div>
                        <h4 style={styles.enrichmentCardTitle}>Talking Points</h4>
                      </div>
                      <ul style={styles.talkingPoints}>
                        {quickEnrich.talking_points.map((point, i) => (
                          <li key={i} style={styles.talkingPoint}>
                            <span style={styles.talkingPointIcon}>→</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Provider Info */}
                  <div style={{...styles.enrichmentCard, ...styles.enrichmentCardFull, opacity: 0.7}}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'flex', gap: '16px' }}>
                      <span>Provider: {enrichmentRaw?.provider || 'perplexity'}</span>
                      <span>Model: {enrichmentRaw?.model || 'sonar-pro'}</span>
                      {enrichmentRaw?.generated_at && (
                        <span>Generated: {new Date(enrichmentRaw.generated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Scoring Tab */}
          {activeTab === 'scoring' && (
            <>
              <div style={styles.scoreGrid}>
                <div style={styles.scoreCard}>
                  <div style={styles.scoreCardGlow} />
                  <div style={styles.scoreLabel}>MDCP Score</div>
                  <div style={{
                    ...styles.scoreCircle,
                    background: `conic-gradient(${getScoreColor(contact.mdcp_score)} ${(contact.mdcp_score || 0) * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                  }}>
                    <span style={styles.scoreValue}>{contact.mdcp_score || '—'}</span>
                  </div>
                  {contact.mdcp_tier && (
                    <span style={{...styles.scoreTier, ...getTierStyle(contact.mdcp_tier)}}>
                      {contact.mdcp_tier.toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div style={styles.scoreCard}>
                  <div style={styles.scoreCardGlow} />
                  <div style={styles.scoreLabel}>BANT Score</div>
                  <div style={{
                    ...styles.scoreCircle,
                    background: `conic-gradient(${getScoreColor(contact.bant_score)} ${(contact.bant_score || 0) * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                  }}>
                    <span style={styles.scoreValue}>{contact.bant_score || '—'}</span>
                  </div>
                  {contact.bant_tier && (
                    <span style={{...styles.scoreTier, ...getTierStyle(contact.bant_tier)}}>
                      {contact.bant_tier.toUpperCase()}
                    </span>
                  )}
                </div>
                
                <div style={styles.scoreCard}>
                  <div style={styles.scoreCardGlow} />
                  <div style={styles.scoreLabel}>SPICE Score</div>
                  <div style={{
                    ...styles.scoreCircle,
                    background: `conic-gradient(${getScoreColor(contact.spice_score)} ${(contact.spice_score || 0) * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                  }}>
                    <span style={styles.scoreValue}>{contact.spice_score || '—'}</span>
                  </div>
                  {contact.spice_tier && (
                    <span style={{...styles.scoreTier, ...getTierStyle(contact.spice_tier)}}>
                      {contact.spice_tier.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {contact.overall_score && (
                <div style={styles.overallScore}>
                  <div style={styles.overallLabel}>Overall Lead Score</div>
                  <div style={styles.overallValue}>{contact.overall_score}</div>
                </div>
              )}
            </>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div style={styles.activityTimeline}>
              <div style={styles.activityLine} />
              
              {contact.enrichment_status === 'completed' && (
                <div style={styles.activityItem}>
                  <div style={{...styles.activityDot, background: '#4ade80'}} />
                  <div style={styles.activityContent}>
                    <div style={styles.activityTitle}>✨ Contact Enriched</div>
                    <div style={styles.activityDesc}>
                      AI-powered insights, talking points, and opener generated
                    </div>
                    <div style={styles.activityTime}>
                      {enrichmentRaw?.generated_at 
                        ? new Date(enrichmentRaw.generated_at).toLocaleString()
                        : 'Recently'}
                    </div>
                  </div>
                </div>
              )}
              
              <div style={styles.activityItem}>
                <div style={styles.activityDot} />
                <div style={styles.activityContent}>
                  <div style={styles.activityTitle}>📥 Contact Created</div>
                  <div style={styles.activityDesc}>
                    Added to workspace from import
                  </div>
                  <div style={styles.activityTime}>
                    {new Date(contact.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              
              {contact.mdcp_score && (
                <div style={styles.activityItem}>
                  <div style={{...styles.activityDot, background: getScoreColor(contact.mdcp_score)}} />
                  <div style={styles.activityContent}>
                    <div style={styles.activityTitle}>📊 Lead Scored</div>
                    <div style={styles.activityDesc}>
                      MDCP: {contact.mdcp_score} • BANT: {contact.bant_score || '—'} • SPICE: {contact.spice_score || '—'}
                    </div>
                    <div style={styles.activityTime}>Auto-scored on import</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.footerMeta}>
            ID: {contact.id.slice(0, 8)}... • Created {new Date(contact.created_at).toLocaleDateString()}
          </div>
          <div style={styles.footerActions}>
            {isEditing ? (
              <>
                <button
                  style={styles.btnSecondary}
                  onClick={() => {
                    setIsEditing(false);
                    setEditData(contact);
                  }}
                >
                  Cancel
                </button>
                <button
                  style={styles.btnPrimary}
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button
                  style={styles.btnSecondary}
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Edit
                </button>
                {!hasEnrichment && (
                  <button
                    style={styles.btnPrimary}
                    onClick={handleEnrich}
                    disabled={isEnriching}
                  >
                    {isEnriching ? '⟳ Enriching...' : '⚡ Enrich'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailModal;

