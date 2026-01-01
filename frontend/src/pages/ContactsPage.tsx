/**
 * ContactsPage.tsx - Premium Version
 * Clean, modern design using LatticeIQ Design System
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Contact } from '../types';
import { fetchContacts, getAuthToken } from '../api/contacts';
import ContactDetailModal from '../components/ContactDetailModal';
import { injectAnimations } from '../styles';
import { colors, gradients, spacing, radius, fontSizes, fontWeights, transitions, shadows } from '../styles/theme';

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: '32px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    margin: 0,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: spacing.sm,
  },
  btnPrimary: {
    background: gradients.accentPrimary,
    color: 'white',
    border: 'none',
    borderRadius: radius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    boxShadow: shadows.accentSm,
    transition: transitions.normal,
  },
  btnSecondary: {
    background: colors.bgCard,
    color: colors.textSecondary,
    border: `1px solid ${colors.borderMedium}`,
    borderRadius: radius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    transition: transitions.normal,
  },
  btnSuccess: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: radius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    transition: transitions.normal,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    background: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    border: `1px solid ${colors.borderSubtle}`,
    position: 'relative',
    overflow: 'hidden',
  },
  statCardAccent: {
    background: gradients.accentSubtle,
    border: '1px solid rgba(102, 126, 234, 0.3)',
  },
  statIcon: {
    fontSize: '20px',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: '28px',
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
    lineHeight: 1,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  filtersBar: {
    display: 'flex',
    gap: spacing.md,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    minWidth: '300px',
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: spacing.md,
    top: '50%',
    transform: 'translateY(-50%)',
    color: colors.textMuted,
    fontSize: '16px',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    background: colors.bgCard,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radius.lg,
    padding: `${spacing.sm} ${spacing.md} ${spacing.sm} 44px`,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    outline: 'none',
    transition: transitions.fast,
  },
  filterSelect: {
    background: colors.bgCard,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radius.md,
    padding: `${spacing.sm} ${spacing.lg} ${spacing.sm} ${spacing.md}`,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    outline: 'none',
    cursor: 'pointer',
    minWidth: '140px',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
  },
  tableContainer: {
    background: colors.bgCard,
    borderRadius: radius.xl,
    border: `1px solid ${colors.borderSubtle}`,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  thead: {
    background: 'rgba(0, 0, 0, 0.3)',
  },
  th: {
    padding: `${spacing.md} ${spacing.lg}`,
    textAlign: 'left',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${colors.borderSubtle}`,
    whiteSpace: 'nowrap',
  },
  thSortable: {
    cursor: 'pointer',
    userSelect: 'none',
  },
  tr: {
    borderBottom: `1px solid ${colors.borderSubtle}`,
    transition: transitions.fast,
  },
  trHover: {
    background: colors.bgCardHover,
  },
  td: {
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    verticalAlign: 'middle',
  },
  contactCell: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: radius.full,
    background: gradients.accentSubtle,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.accentPrimary,
    flexShrink: 0,
  },
  contactInfo: {
    overflow: 'hidden',
  },
  contactName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  contactEmail: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  scoreBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '44px',
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: radius.md,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  scoreHot: {
    background: colors.tierHotBg,
    color: colors.tierHot,
    border: `1px solid ${colors.tierHotBorder}`,
  },
  scoreWarm: {
    background: colors.tierWarmBg,
    color: colors.tierWarm,
    border: `1px solid ${colors.tierWarmBorder}`,
  },
  scoreCold: {
    background: colors.tierColdBg,
    color: colors.tierCold,
    border: `1px solid ${colors.tierColdBorder}`,
  },
  scoreNone: {
    background: 'rgba(255,255,255,0.05)',
    color: colors.textMuted,
    border: `1px solid ${colors.borderSubtle}`,
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: radius.full,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
  },
  statusCompleted: {
    background: colors.successBg,
    color: colors.success,
  },
  statusPending: {
    background: colors.warningBg,
    color: colors.warning,
  },
  statusFailed: {
    background: colors.errorBg,
    color: colors.error,
  },
  viewBtn: {
    background: 'transparent',
    border: `1px solid ${colors.borderMedium}`,
    borderRadius: radius.md,
    padding: `${spacing.xs} ${spacing.md}`,
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    cursor: 'pointer',
    transition: transitions.fast,
  },
  viewBtnHover: {
    background: colors.accentLight,
    borderColor: colors.accentPrimary,
    color: colors.textPrimary,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: colors.accentPrimary,
    cursor: 'pointer',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderTop: `1px solid ${colors.borderSubtle}`,
  },
  paginationInfo: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  paginationButtons: {
    display: 'flex',
    gap: spacing.sm,
  },
  pageBtn: {
    background: colors.bgCard,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radius.md,
    padding: `${spacing.sm} ${spacing.md}`,
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    cursor: 'pointer',
    transition: transitions.fast,
  },
  pageBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  emptyState: {
    padding: spacing.xxl,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  loading: {
    padding: spacing.xxl,
    textAlign: 'center',
    color: colors.textMuted,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    background: colors.accentLight,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  toolbarText: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    fontWeight: fontWeights.medium,
  },
  toolbarActions: {
    display: 'flex',
    gap: spacing.sm,
  },
};

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({ search: '', tier: 'all', status: 'all' });
  const [sort, setSort] = useState({ field: 'created_at', direction: 'desc' as 'asc' | 'desc' });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });

  useEffect(() => {
    injectAnimations();
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await fetchContacts(1000, 0);
      const arr = Array.isArray(data) ? data : (data as any).contacts || [];
      setContacts(arr);
      setPagination(p => ({ ...p, total: arr.length }));
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = useMemo(() => {
    let result = contacts;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c =>
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q)
      );
    }
    if (filters.tier !== 'all') {
      result = result.filter(c => {
        const s = c.mdcp_score || 0;
        if (filters.tier === 'hot') return s >= 71;
        if (filters.tier === 'warm') return s >= 40 && s < 71;
        if (filters.tier === 'cold') return s < 40;
        return true;
      });
    }
    if (filters.status !== 'all') {
      result = result.filter(c => c.enrichment_status === filters.status);
    }
    return result;
  }, [contacts, filters]);

  const sortedContacts = useMemo(() => {
    const sorted = [...filteredContacts];
    sorted.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sort.field === 'name') {
        aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
        bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
      } else if (sort.field === 'mdcp_score') {
        aVal = a.mdcp_score || 0;
        bVal = b.mdcp_score || 0;
      } else {
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
      }
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredContacts, sort]);

  const paginatedContacts = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    return sortedContacts.slice(start, start + pagination.pageSize);
  }, [sortedContacts, pagination.page, pagination.pageSize]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const hot = contacts.filter(c => (c.mdcp_score || 0) >= 71).length;
    const warm = contacts.filter(c => (c.mdcp_score || 0) >= 40 && (c.mdcp_score || 0) < 71).length;
    const cold = contacts.filter(c => (c.mdcp_score || 0) > 0 && (c.mdcp_score || 0) < 40).length;
    const enriched = contacts.filter(c => c.enrichment_status === 'completed').length;
    const scored = contacts.filter(c => c.mdcp_score && c.mdcp_score > 0).length;
    return { total, hot, warm, cold, enriched, scored };
  }, [contacts]);

  const totalPages = Math.ceil(sortedContacts.length / pagination.pageSize);

  const getScoreStyle = (score?: number) => {
    if (!score) return styles.scoreNone;
    if (score >= 71) return styles.scoreHot;
    if (score >= 40) return styles.scoreWarm;
    return styles.scoreCold;
  };

  const getStatusStyle = (status?: string) => {
    if (status === 'completed') return styles.statusCompleted;
    if (status === 'failed') return styles.statusFailed;
    return styles.statusPending;
  };

  const getInitials = (c: Contact) =>
    `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase() || '?';

  const handleSort = (field: string) => {
    setSort(s => ({
      field,
      direction: s.field === field && s.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(new Set(paginatedContacts.map(c => c.id)));
    } else {
      setSelectedContacts(new Set());
    }
  };

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Company', 'MDCP', 'BANT', 'SPICE', 'Status'];
    const rows = sortedContacts.map(c => [
      `${c.first_name} ${c.last_name}`,
      c.email,
      c.company || '',
      c.mdcp_score || '',
      c.bant_score || '',
      c.spice_score || '',
      c.enrichment_status || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleBulkEnrich = async () => {
    if (selectedContacts.size === 0) return;
    setEnriching(true);
    const token = await getAuthToken();
    const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
    let success = 0;
    for (const id of selectedContacts) {
      try {
        const res = await fetch(`${API_BASE}/api/v3/enrichment/quick-enrich/${id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) success++;
      } catch { /* ignore */ }
    }
    setEnriching(false);
    alert(`Enriched & scored ${success}/${selectedContacts.size} contacts`);
    setSelectedContacts(new Set());
    loadContacts();
  };

  const handleBulkScore = async () => {
    if (selectedContacts.size === 0) return;
    setScoring(true);
    const token = await getAuthToken();
    const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';
    let success = 0;
    for (const id of selectedContacts) {
      try {
        const res = await fetch(`${API_BASE}/api/v3/enrichment/score/${id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) success++;
      } catch { /* ignore */ }
    }
    setScoring(false);
    alert(`Scored ${success}/${selectedContacts.size} contacts`);
    setSelectedContacts(new Set());
    loadContacts();
  };

  const handleEnrichAndScore = async () => {
    // Enrich includes scoring now, so just call enrich
    await handleBulkEnrich();
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.title}>Contacts</h1>
            <p style={styles.subtitle}>Manage, enrich, and score your contact database</p>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.btnSecondary} onClick={handleExport}>
              <span>📥</span> Export
            </button>
            <button style={styles.btnPrimary}>
              <span>➕</span> Add Contact
            </button>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <div style={{...styles.statCard, ...styles.statCardAccent}}>
            <div style={styles.statIcon}>📊</div>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Total Contacts</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🔥</div>
            <div style={{...styles.statValue, color: colors.tierHot}}>{stats.hot}</div>
            <div style={styles.statLabel}>Hot Leads</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>⭐</div>
            <div style={{...styles.statValue, color: colors.tierWarm}}>{stats.warm}</div>
            <div style={styles.statLabel}>Warm Leads</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>❄️</div>
            <div style={{...styles.statValue, color: colors.tierCold}}>{stats.cold}</div>
            <div style={styles.statLabel}>Cold Leads</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>✨</div>
            <div style={styles.statValue}>{stats.enriched}</div>
            <div style={styles.statLabel}>Enriched</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🎯</div>
            <div style={styles.statValue}>{stats.scored}</div>
            <div style={styles.statLabel}>Scored</div>
          </div>
        </div>
      </div>

      <div style={styles.filtersBar}>
        <div style={styles.searchContainer}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search contacts..."
            value={filters.search}
            onChange={e => setFilters({...filters, search: e.target.value})}
            style={styles.searchInput}
          />
        </div>
        <select
          value={filters.tier}
          onChange={e => setFilters({...filters, tier: e.target.value})}
          style={styles.filterSelect}
        >
          <option value="all">All Tiers</option>
          <option value="hot">🔥 Hot</option>
          <option value="warm">⭐ Warm</option>
          <option value="cold">❄️ Cold</option>
        </select>
        <select
          value={filters.status}
          onChange={e => setFilters({...filters, status: e.target.value})}
          style={styles.filterSelect}
        >
          <option value="all">All Status</option>
          <option value="completed">✓ Enriched</option>
          <option value="pending">○ Pending</option>
          <option value="failed">✕ Failed</option>
        </select>
      </div>

      {selectedContacts.size > 0 && (
        <div style={styles.toolbar}>
          <span style={styles.toolbarText}>{selectedContacts.size} selected</span>
          <div style={styles.toolbarActions}>
            <button 
              style={styles.btnSuccess} 
              onClick={handleEnrichAndScore}
              disabled={enriching}
            >
              {enriching ? '⏳ Processing...' : '✨ Enrich & Score'}
            </button>
            <button 
              style={styles.btnPrimary} 
              onClick={handleBulkScore}
              disabled={scoring}
            >
              {scoring ? '⏳ Scoring...' : '🎯 Re-Score'}
            </button>
            <button style={styles.btnSecondary} onClick={() => setSelectedContacts(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.thead}>
            <tr>
              <th style={{...styles.th, width: '50px'}}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContacts.has(c.id))}
                  onChange={e => handleSelectAll(e.target.checked)}
                />
              </th>
              <th style={{...styles.th, ...styles.thSortable}} onClick={() => handleSort('name')}>
                Contact {sort.field === 'name' && (sort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th style={styles.th}>Company</th>
              <th style={{...styles.th, ...styles.thSortable, textAlign: 'center'}} onClick={() => handleSort('mdcp_score')}>
                MDCP {sort.field === 'mdcp_score' && (sort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{...styles.th, textAlign: 'center'}}>BANT</th>
              <th style={{...styles.th, textAlign: 'center'}}>SPICE</th>
              <th style={{...styles.th, textAlign: 'center'}}>Status</th>
              <th style={{...styles.th, width: '80px'}}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={styles.loading}>Loading contacts...</td></tr>
            ) : paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={8} style={styles.emptyState}>
                  <div style={styles.emptyIcon}>👥</div>
                  <div style={styles.emptyTitle}>No contacts found</div>
                  <div style={styles.emptyText}>Try adjusting your filters</div>
                </td>
              </tr>
            ) : (
              paginatedContacts.map(contact => (
                <tr
                  key={contact.id}
                  style={{...styles.tr, ...(hoveredRow === contact.id ? styles.trHover : {})}}
                  onMouseEnter={() => setHoveredRow(contact.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={styles.td}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={selectedContacts.has(contact.id)}
                      onChange={e => {
                        const s = new Set(selectedContacts);
                        e.target.checked ? s.add(contact.id) : s.delete(contact.id);
                        setSelectedContacts(s);
                      }}
                    />
                  </td>
                  <td style={styles.td}>
                    <div style={styles.contactCell}>
                      <div style={styles.contactAvatar}>{getInitials(contact)}</div>
                      <div style={styles.contactInfo}>
                        <p style={styles.contactName}>{contact.first_name} {contact.last_name}</p>
                        <p style={styles.contactEmail}>{contact.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>{contact.company || '—'}</td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <span style={{...styles.scoreBadge, ...getScoreStyle(contact.mdcp_score)}}>
                      {contact.mdcp_score || '—'}
                    </span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <span style={{...styles.scoreBadge, ...getScoreStyle(contact.bant_score)}}>
                      {contact.bant_score || '—'}
                    </span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <span style={{...styles.scoreBadge, ...getScoreStyle(contact.spice_score)}}>
                      {contact.spice_score || '—'}
                    </span>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <span style={{...styles.statusBadge, ...getStatusStyle(contact.enrichment_status)}}>
                      {contact.enrichment_status === 'completed' ? '✓ Enriched' :
                       contact.enrichment_status === 'failed' ? '✕ Failed' : '○ Pending'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={{...styles.viewBtn, ...(hoveredBtn === contact.id ? styles.viewBtnHover : {})}}
                      onMouseEnter={() => setHoveredBtn(contact.id)}
                      onMouseLeave={() => setHoveredBtn(null)}
                      onClick={() => { setSelectedContact(contact); setModalOpen(true); }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && paginatedContacts.length > 0 && (
          <div style={styles.pagination}>
            <div style={styles.paginationInfo}>
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, sortedContacts.length)} of {sortedContacts.length}
            </div>
            <div style={styles.paginationButtons}>
              <button
                style={{...styles.pageBtn, ...(pagination.page === 1 ? styles.pageBtnDisabled : {})}}
                disabled={pagination.page === 1}
                onClick={() => setPagination(p => ({...p, page: p.page - 1}))}
              >
                ← Previous
              </button>
              <button
                style={{...styles.pageBtn, ...(pagination.page >= totalPages ? styles.pageBtnDisabled : {})}}
                disabled={pagination.page >= totalPages}
                onClick={() => setPagination(p => ({...p, page: p.page + 1}))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedContact(null); }}
          onEnrich={async () => { await loadContacts(); }}
          onUpdate={(updated) => {
            setContacts(contacts.map(c => c.id === updated.id ? updated : c));
          }}
        />
      )}
    </div>
  );
};

export default ContactsPage;