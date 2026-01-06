// frontend/src/pages/ContactsPage.tsx
import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Upload, Zap, Trash2, Users } from 'lucide-react';
import { fetchContacts, deleteContact } from '../api/contacts';
import { Contact } from '../types';
import { ContactDetailModal } from '../components/ContactDetailModal';


export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);


  useEffect(() => {
    loadContacts();
  }, []);


  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await fetchContacts();
      setContacts(data.contacts || data);  // FIXED: changed 'response' to 'data'
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


  const getTier = (contact: Contact): 'hot' | 'warm' | 'cold' => {
    const score = contact.mdcp_score || 0;
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  };


  // Helper function for contact name
  const getContactName = (contact: Contact): string => {
    return `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || 'Unknown';
  };

  // Helper function for initials
  const getInitials = (contact: Contact): string => {
    const name = getContactName(contact);
    return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  };


  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      getContactName(contact).toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    return matchesSearch && getTier(contact) === filter;
  });


  const counts = {
    all: contacts.length,
    hot: contacts.filter(c => getTier(c) === 'hot').length,
    warm: contacts.filter(c => getTier(c) === 'warm').length,
    cold: contacts.filter(c => getTier(c) === 'cold').length,
  };


  // Inline styles to guarantee they apply (matching Contact Detail page exactly)
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
  };


  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
          <p>Loading contacts...</p>
        </div>
      </div>
    );
  }


  return (
    <div style={styles.page}>
      {/* Header */}
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
          <button style={styles.btnSecondary} onClick={loadContacts}>
            <RefreshCw size={18} />
            Refresh
          </button>
          <button style={styles.btnPrimary}>
            <Upload size={18} />
            Import
          </button>
        </div>
      </div>


      {/* Search & Filters Card */}
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


      {/* Table Card */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Contact</th>
              <th style={styles.th}>Company</th>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>MDCP</th>
              <th style={styles.th}>BANT</th>
              <th style={styles.th}>SPICE</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((contact) => (
              <tr 
                key={contact.id} 
                style={styles.tr}
                onClick={() => setSelectedContact(contact)}
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
                    <button style={styles.actionBtn} title="Enrich">
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


        {filteredContacts.length === 0 && (
          <div style={styles.emptyState}>
            <p>No contacts found matching your criteria.</p>
          </div>
        )}
      </div>


      {/* Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
}
