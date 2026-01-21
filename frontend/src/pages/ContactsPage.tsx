// frontend/src/pages/ContactsPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Loader2, RefreshCw, Upload, Zap, Trash2, Users, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Calculator, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchContacts, deleteContact } from '../api/contacts';
import { Contact } from '../types';
import ContactDetailModal from '../components/ContactDetailModal';

const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

type SortField = 'name' | 'company' | 'title' | 'mdcp_score' | 'bant_score' | 'spice_score' | 'enrichment_status';
type SortDirection = 'asc' | 'desc';



export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // NEW: Scoring state
  const [isScoring, setIsScoring] = useState(false);
  const [scoreSuccess, setScoreSuccess] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  
  // NEW: Selection state for batch operations
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  
  // NEW: Import state
  const [isImporting, setIsImporting] = useState(false);
  
  // NEW: Modal initial tab
  const [initialTab, setInitialTab] = useState<'overview' | 'enrichment' | 'outreach' | 'scores'>('overview');



  useEffect(() => {
    loadContacts();
  }, []);



  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, pageSize]);


  // NEW: Clear toast messages after 5 seconds
  useEffect(() => {
    if (scoreSuccess) {
      const timer = setTimeout(() => setScoreSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [scoreSuccess]);

  useEffect(() => {
    if (scoreError) {
      const timer = setTimeout(() => setScoreError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [scoreError]);



  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await fetchContacts();
      setContacts(data.contacts || data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await deleteContact(id);
      setContacts(contacts.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };



  const handleRowClick = (contact: Contact) => {
    setSelectedContact(contact);
    setInitialTab('overview');
    setIsModalOpen(true);
  };



  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContact(null);
  };


  // NEW: Handle Enrich button click - opens modal to enrichment tab
  const handleEnrichClick = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedContact(contact);
    setInitialTab('enrichment');
    setIsModalOpen(true);
  };



  const getTier = (contact: Contact): 'hot' | 'warm' | 'cold' => {
    const score = contact.mdcp_score || 0;
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  };



  const getContactName = (contact: Contact): string => {
    return `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
  };



  const getInitials = (contact: Contact): string => {
    const name = getContactName(contact);
    return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  };



  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };



  // Filter and sort contacts
  const filteredAndSortedContacts = useMemo(() => {
    let result = contacts.filter(contact => {
      const matchesSearch = 
        getContactName(contact).toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filter === 'all') return matchesSearch;
      return matchesSearch && getTier(contact) === filter;
    });


    // Sort
    result.sort((a, b) => {
      let aValue: any;
      let bValue: any;


      switch (sortField) {
        case 'name':
          aValue = getContactName(a).toLowerCase();
          bValue = getContactName(b).toLowerCase();
          break;
        case 'company':
          aValue = (a.company || '').toLowerCase();
          bValue = (b.company || '').toLowerCase();
          break;
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'mdcp_score':
          aValue = a.mdcp_score || 0;
          bValue = b.mdcp_score || 0;
          break;
        case 'bant_score':
          aValue = a.bant_score || 0;
          bValue = b.bant_score || 0;
          break;
        case 'spice_score':
          aValue = a.spice_score || 0;
          bValue = b.spice_score || 0;
          break;
        case 'enrichment_status':
          aValue = (a.enrichment_status || 'pending').toLowerCase();
          bValue = (b.enrichment_status || 'pending').toLowerCase();
          break;
        default:
          aValue = '';
          bValue = '';
      }


      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });


    return result;
  }, [contacts, searchTerm, filter, sortField, sortDirection]);



  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedContacts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedContacts = filteredAndSortedContacts.slice(startIndex, endIndex);



  const counts = {
    all: contacts.length,
    hot: contacts.filter(c => getTier(c) === 'hot').length,
    warm: contacts.filter(c => getTier(c) === 'warm').length,
    cold: contacts.filter(c => getTier(c) === 'cold').length,
  };



  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span style={{ opacity: 0.3, marginLeft: '4px' }}><ChevronUp size={14} /></span>;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp size={14} style={{ marginLeft: '4px', color: '#6366f1' }} />
      : <ChevronDown size={14} style={{ marginLeft: '4px', color: '#6366f1' }} />;
  };



  const styles = {
    page: {
      minHeight: '100vh',
      background: '#0f172a',
      padding: '2rem',
      color: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } as React.CSSProperties,
    
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '2rem',
      paddingBottom: '1.5rem',
      borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
    } as React.CSSProperties,
    
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    } as React.CSSProperties,
    
    headerIcon: {
      width: '48px',
      height: '48px',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6366f1',
    } as React.CSSProperties,
    
    title: {
      fontSize: '2rem',
      fontWeight: 800,
      margin: 0,
      letterSpacing: '-0.02em',
    } as React.CSSProperties,
    
    subtitle: {
      fontSize: '0.95rem',
      color: '#94a3b8',
      margin: '0.25rem 0 0 0',
    } as React.CSSProperties,
    
    headerActions: {
      display: 'flex',
      gap: '1rem',
    } as React.CSSProperties,
    
    btnPrimary: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      border: 'none',
      borderRadius: '10px',
      color: 'white',
      fontWeight: 600,
      fontSize: '0.95rem',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    
    btnSecondary: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1.5rem',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '10px',
      color: '#f8fafc',
      fontWeight: 600,
      fontSize: '0.95rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,

    // NEW: Success button style for Score All
    btnSuccess: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      border: 'none',
      borderRadius: '10px',
      color: 'white',
      fontWeight: 600,
      fontSize: '0.95rem',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,

    // NEW: Disabled button style
    btnDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    } as React.CSSProperties,
    
    controlsCard: {
      background: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,
    
    searchInput: {
      width: '100%',
      padding: '0.875rem 1.25rem',
      background: '#0f172a',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: '10px',
      color: '#f8fafc',
      fontSize: '0.95rem',
      marginBottom: '1rem',
      outline: 'none',
    } as React.CSSProperties,
    
    filterTabs: {
      display: 'flex',
      gap: '0.75rem',
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,
    
    filterTab: {
      padding: '0.6rem 1.25rem',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '8px',
      color: '#f8fafc',
      fontWeight: 600,
      fontSize: '0.9rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    
    filterTabActive: {
      padding: '0.6rem 1.25rem',
      background: '#6366f1',
      border: '1px solid #6366f1',
      borderRadius: '8px',
      color: 'white',
      fontWeight: 600,
      fontSize: '0.9rem',
      cursor: 'pointer',
    } as React.CSSProperties,
    
    tableCard: {
      background: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
    } as React.CSSProperties,
    
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
    } as React.CSSProperties,
    
    th: {
      padding: '1.25rem 1rem',
      textAlign: 'left' as const,
      fontWeight: 700,
      fontSize: '0.7rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      color: '#64748b',
      background: 'rgba(99, 102, 241, 0.05)',
      borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
      cursor: 'pointer',
      userSelect: 'none' as const,
      transition: 'background 0.2s ease',
    } as React.CSSProperties,
    
    thHover: {
      background: 'rgba(99, 102, 241, 0.1)',
    } as React.CSSProperties,
    
    thContent: {
      display: 'flex',
      alignItems: 'center',
    } as React.CSSProperties,
    
    tr: {
      borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
      cursor: 'pointer',
      transition: 'background 200ms ease',
    } as React.CSSProperties,
    
    td: {
      padding: '1rem',
      color: '#e2e8f0',
      fontSize: '0.95rem',
    } as React.CSSProperties,
    
    contactInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    } as React.CSSProperties,
    
    avatar: {
      width: '40px',
      height: '40px',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '0.8rem',
      color: 'white',
      flexShrink: 0,
    } as React.CSSProperties,
    
    contactName: {
      fontWeight: 600,
      color: '#f8fafc',
      display: 'block',
    } as React.CSSProperties,
    
    contactEmail: {
      fontSize: '0.85rem',
      color: '#64748b',
      display: 'block',
    } as React.CSSProperties,
    
    statusBadge: (status: string) => ({
      display: 'inline-flex',
      padding: '0.4rem 0.9rem',
      borderRadius: '6px',
      fontSize: '0.8rem',
      fontWeight: 700,
      textTransform: 'capitalize' as const,
      background: status === 'completed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
      color: status === 'completed' ? '#22c55e' : '#f59e0b',
      border: `1px solid ${status === 'completed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
    }) as React.CSSProperties,
    
    actionButtons: {
      display: 'flex',
      gap: '0.5rem',
    } as React.CSSProperties,
    
    actionBtn: {
      width: '34px',
      height: '34px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: '8px',
      color: '#64748b',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    
    loading: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '1.5rem',
      color: '#94a3b8',
    } as React.CSSProperties,
    
    emptyState: {
      padding: '4rem 2rem',
      textAlign: 'center' as const,
      color: '#64748b',
    } as React.CSSProperties,


    // Pagination styles
    paginationContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 1.5rem',
      borderTop: '1px solid rgba(148, 163, 184, 0.1)',
      background: 'rgba(99, 102, 241, 0.02)',
    } as React.CSSProperties,


    paginationInfo: {
      fontSize: '0.9rem',
      color: '#94a3b8',
    } as React.CSSProperties,


    paginationControls: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    } as React.CSSProperties,


    paginationBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '36px',
      height: '36px',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '8px',
      color: '#f8fafc',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,


    paginationBtnDisabled: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '36px',
      height: '36px',
      background: 'rgba(148, 163, 184, 0.05)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '8px',
      color: '#475569',
      cursor: 'not-allowed',
    } as React.CSSProperties,


    paginationPageBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '36px',
      height: '36px',
      padding: '0 0.75rem',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '8px',
      color: '#f8fafc',
      fontSize: '0.9rem',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,


    paginationPageBtnActive: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '36px',
      height: '36px',
      padding: '0 0.75rem',
      background: '#6366f1',
      border: '1px solid #6366f1',
      borderRadius: '8px',
      color: 'white',
      fontSize: '0.9rem',
      fontWeight: 600,
      cursor: 'pointer',
    } as React.CSSProperties,


    pageSizeSelect: {
      padding: '0.5rem 0.75rem',
      background: '#0f172a',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: '8px',
      color: '#f8fafc',
      fontSize: '0.9rem',
      cursor: 'pointer',
      outline: 'none',
    } as React.CSSProperties,

    // NEW: Toast styles
    toast: {
      position: 'fixed' as const,
      bottom: '1.5rem',
      right: '1.5rem',
      padding: '1rem 1.5rem',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
      zIndex: 9999,
      animation: 'slideIn 0.3s ease-out',
      fontWeight: 600,
    } as React.CSSProperties,

    successToast: {
      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      color: 'white',
    } as React.CSSProperties,

    errorToast: {
      background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
      color: 'white',
    } as React.CSSProperties,
  };


  // NEW: Score ALL contacts - calls real backend API
  const handleScoreAll = async () => {
    setIsScoring(true);
    setScoreError(null);
    setScoreSuccess(null);

    try {
      const response = await fetch(`${API_URL}/api/v3/scoring/score-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Scoring failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Refresh contacts to show updated scores
      await loadContacts();

      // Show success message
      const scoredCount = data.scored_count || data.scoredCount || contacts.length;
      const failedCount = data.failures?.length || data.failed_count || 0;
      
      if (failedCount > 0) {
        setScoreSuccess(`✅ Scored ${scoredCount} contacts (${failedCount} failed)`);
      } else {
        setScoreSuccess(`✅ Successfully scored ${scoredCount} contacts!`);
      }

    } catch (error: any) {
      console.error('Scoring failed:', error);
      setScoreError(`Failed to score contacts: ${error.message}`);
    } finally {
      setIsScoring(false);
    }
  };


  // UPDATED: Batch score selected contacts - now properly implemented
  const handleBatchScore = async () => {
    const selected = contacts.filter(c => checkedIds.has(c.id)).map(c => c.id);
    if (selected.length === 0) {
      setScoreError("Select contacts first to batch score");
      return;
    }
    
    setIsScoring(true);
    setScoreError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/v3/scoring/batch-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contact_ids: selected }),
      });

      if (!response.ok) {
        throw new Error(`Batch scoring failed: ${response.statusText}`);
      }

      const data = await response.json();
      await loadContacts(); // Refresh
      setScoreSuccess(`✅ Scored ${data.length || selected.length} selected contacts`);
      setCheckedIds(new Set()); // Clear selection
    } catch (error: any) {
      setScoreError(`Failed: ${error.message}`);
    } finally {
      setIsScoring(false);
    }
  };


  // NEW: Handle HubSpot import
  const handleImport = async () => {
    setIsImporting(true);
    setScoreError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/v3/integrations/hubspot/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setScoreSuccess(`✅ Imported ${data.imported || 0} contacts from HubSpot`);
        await loadContacts();
      } else {
        setScoreError('HubSpot import failed. Check your API credentials.');
      }
    } catch (error: any) {
      setScoreError(`Import error: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };



  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };



  if (loading && !isScoring) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
          <p>Loading contacts...</p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }



  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>
            <Users size={24} />
          </div>
          <div>
            <h1 style={styles.title}>Contacts</h1>
            <p style={styles.subtitle}>{contacts.length} contacts • {counts.hot} hot • {counts.warm} warm</p>
          </div>
        </div>
        <div style={styles.headerActions}>
          {/* NEW: Score All Button */}
          <button 
            style={{
              ...styles.btnSuccess,
              ...(isScoring ? styles.btnDisabled : {}),
            }}
            onClick={handleScoreAll}
            disabled={isScoring}
            title="Calculate MDCP, BANT, and SPICE scores for all contacts"
          >
            {isScoring ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Scoring...
              </>
            ) : (
              <>
                <Calculator size={18} />
                Score All
              </>
            )}
          </button>
          <button style={styles.btnSecondary} onClick={loadContacts}>
            <RefreshCw size={18} />
            Refresh
          </button>
          {/* UPDATED: Import button now has onClick */}
          <button 
            style={{
              ...styles.btnPrimary,
              ...(isImporting ? styles.btnDisabled : {}),
            }}
            onClick={handleImport}
            disabled={isImporting}
          >
            <Upload size={18} />
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>



      <div style={styles.controlsCard}>
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.filterTabs}>
          {(['all', 'hot', 'warm', 'cold'] as const).map((f) => (
            <button
              key={f}
              style={filter === f ? styles.filterTabActive : styles.filterTab}
              onClick={() => setFilter(f)}
            >
              {f === 'hot' && '🔥 '}
              {f === 'warm' && '⭐ '}
              {f === 'cold' && '❄️ '}
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
      </div>



      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th 
                style={styles.th} 
                onClick={() => handleSort('name')}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
              >
                <div style={styles.thContent}>
                  Contact <SortIndicator field="name" />
                </div>
              </th>
              <th 
                style={styles.th}
                onClick={() => handleSort('company')}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
              >
                <div style={styles.thContent}>
                  Company <SortIndicator field="company" />
                </div>
              </th>
              <th 
                style={styles.th}
                onClick={() => handleSort('title')}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
              >
                <div style={styles.thContent}>
                  Title <SortIndicator field="title" />
                </div>
              </th>
              <th 
                style={styles.th}
                onClick={() => handleSort('mdcp_score')}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
              >
                <div style={styles.thContent}>
                  MDCP <SortIndicator field="mdcp_score" />
                </div>
              </th>
              <th 
                style={styles.th}
                onClick={() => handleSort('bant_score')}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
              >
                <div style={styles.thContent}>
                  BANT <SortIndicator field="bant_score" />
                </div>
              </th>
              <th 
                style={styles.th}
                onClick={() => handleSort('spice_score')}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
              >
                <div style={styles.thContent}>
                  SPICE <SortIndicator field="spice_score" />
                </div>
              </th>
              <th 
                style={styles.th}
                onClick={() => handleSort('enrichment_status')}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
              >
                <div style={styles.thContent}>
                  Status <SortIndicator field="enrichment_status" />
                </div>
              </th>
              <th style={{...styles.th, cursor: 'default'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedContacts.map((contact) => (
              <tr
                key={contact.id}
                style={styles.tr}
                onClick={() => handleRowClick(contact)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={styles.td}>
                  <div style={styles.contactInfo}>
                    <div style={styles.avatar}>
                      {getInitials(contact)}
                    </div>
                    <div>
                      <span style={styles.contactName}>{getContactName(contact)}</span>
                      <span style={styles.contactEmail}>{contact.email || 'No email'}</span>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>{contact.company || '—'}</td>
                <td style={styles.td}>{contact.title || '—'}</td>
                <td style={styles.td}>{contact.mdcp_score || '—'}</td>
                <td style={styles.td}>{contact.bant_score || '—'}</td>
                <td style={styles.td}>{contact.spice_score || '—'}</td>
                <td style={styles.td}>
                  <span style={styles.statusBadge(contact.enrichment_status || 'pending')}>
                    {contact.enrichment_status || 'pending'}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={styles.actionButtons} onClick={(e) => e.stopPropagation()}>
                    {/* UPDATED: Enrich button now has onClick */}
                    <button 
                      style={styles.actionBtn} 
                      title="Enrich"
                      onClick={(e) => handleEnrichClick(contact, e)}
                    >
                      <Zap size={16} />
                    </button>
                    <button 
                      style={styles.actionBtn}
                      title="Delete"
                      onClick={(e) => handleDelete(contact.id, e)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>



        {filteredAndSortedContacts.length === 0 && (
          <div style={styles.emptyState}>
            <p>No contacts found matching your criteria.</p>
          </div>
        )}


        {/* Pagination */}
        {filteredAndSortedContacts.length > 0 && (
          <div style={styles.paginationContainer}>
            <div style={styles.paginationInfo}>
              Showing {startIndex + 1} - {Math.min(endIndex, filteredAndSortedContacts.length)} of {filteredAndSortedContacts.length} contacts
            </div>
            
            <div style={styles.paginationControls}>
              <select 
                value={pageSize} 
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={styles.pageSizeSelect}
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>


              <button
                style={currentPage === 1 ? styles.paginationBtnDisabled : styles.paginationBtn}
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First page"
              >
                <ChevronLeft size={16} />
                <ChevronLeft size={16} style={{ marginLeft: '-10px' }} />
              </button>


              <button
                style={currentPage === 1 ? styles.paginationBtnDisabled : styles.paginationBtn}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>


              {getPageNumbers().map((page, idx) => (
                typeof page === 'number' ? (
                  <button
                    key={idx}
                    style={currentPage === page ? styles.paginationPageBtnActive : styles.paginationPageBtn}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={idx} style={{ color: '#64748b', padding: '0 0.25rem' }}>...</span>
                )
              ))}


              <button
                style={currentPage === totalPages ? styles.paginationBtnDisabled : styles.paginationBtn}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>


              <button
                style={currentPage === totalPages ? styles.paginationBtnDisabled : styles.paginationBtn}
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Last page"
              >
                <ChevronRight size={16} />
                <ChevronRight size={16} style={{ marginLeft: '-10px' }} />
              </button>
            </div>
          </div>
        )}
      </div>


      {/* NEW: Success Toast */}
      {scoreSuccess && (
        <div style={{ ...styles.toast, ...styles.successToast }}>
          <CheckCircle size={20} />
          {scoreSuccess}
        </div>
      )}

      {/* NEW: Error Toast */}
      {scoreError && (
        <div style={{ ...styles.toast, ...styles.errorToast }}>
          <AlertCircle size={20} />
          {scoreError}
        </div>
      )}


      {/* UPDATED: Modal now passes initialTab */}
      {isModalOpen && selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          initialTab={initialTab}
        />
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
