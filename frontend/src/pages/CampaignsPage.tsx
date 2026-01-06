// frontend/src/pages/CampaignsPage.tsx
import { useState, useEffect } from 'react';
import { 
  Loader2, RefreshCw, Plus, Play, Pause, Trash2, 
  Target, Mail, Users, TrendingUp, Calendar, Eye
} from 'lucide-react';
import { Contact } from '../types';
import { fetchContacts } from '../api/contacts';
import { ContactDetailModal } from '../components/ContactDetailModal';


interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  target_count: number;
  sent_count: number;
  opened_count: number;
  replied_count: number;
  created_at: string;
  scheduled_at?: string;
}


export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'icps'>('campaigns');


  useEffect(() => {
    loadData();
  }, []);


  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchContacts();
      setContacts(data.contacts || data);
      
      // Mock campaigns for now - replace with API call
      setCampaigns([
        {
          id: '1',
          name: 'Q1 Decision Makers Outreach',
          status: 'active',
          target_count: 150,
          sent_count: 89,
          opened_count: 42,
          replied_count: 12,
          created_at: '2026-01-01T00:00:00Z',
          scheduled_at: '2026-01-15T09:00:00Z'
        },
        {
          id: '2',
          name: 'Tech Leaders - SaaS Focus',
          status: 'draft',
          target_count: 75,
          sent_count: 0,
          opened_count: 0,
          replied_count: 0,
          created_at: '2026-01-03T00:00:00Z'
        }
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };


  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' };
      case 'paused': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'completed': return { bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' };
      default: return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };


  const getContactName = (contact: Contact): string => {
    return `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
  };


  // Inline styles matching your design system
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
    
    tabs: {
      display: 'flex',
      gap: '0.5rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,
    
    tab: {
      padding: '0.75rem 1.5rem',
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '10px',
      color: '#94a3b8',
      fontWeight: 600,
      fontSize: '0.9rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,
    
    tabActive: {
      padding: '0.75rem 1.5rem',
      background: 'rgba(99, 102, 241, 0.15)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '10px',
      color: '#f8fafc',
      fontWeight: 600,
      fontSize: '0.9rem',
      cursor: 'pointer',
    } as React.CSSProperties,
    
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '1rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,
    
    statCard: {
      background: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '14px',
      padding: '1.25rem',
    } as React.CSSProperties,
    
    statValue: {
      fontSize: '2rem',
      fontWeight: 300,
      color: '#f8fafc',
      margin: 0,
    } as React.CSSProperties,
    
    statLabel: {
      fontSize: '0.8rem',
      fontWeight: 600,
      color: '#64748b',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      marginTop: '0.25rem',
    } as React.CSSProperties,
    
    campaignCard: {
      background: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1rem',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    } as React.CSSProperties,
    
    campaignHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '1rem',
    } as React.CSSProperties,
    
    campaignName: {
      fontSize: '1.15rem',
      fontWeight: 700,
      color: '#f8fafc',
      margin: 0,
    } as React.CSSProperties,
    
    campaignMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginTop: '0.5rem',
      fontSize: '0.85rem',
      color: '#64748b',
    } as React.CSSProperties,
    
    statusBadge: (status: Campaign['status']) => {
      const colors = getStatusColor(status);
      return {
        display: 'inline-flex',
        padding: '0.4rem 0.9rem',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: 700,
        textTransform: 'capitalize' as const,
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      } as React.CSSProperties;
    },
    
    metricsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '1rem',
      padding: '1rem 0',
      borderTop: '1px solid rgba(148, 163, 184, 0.1)',
    } as React.CSSProperties,
    
    metric: {
      textAlign: 'center' as const,
    } as React.CSSProperties,
    
    metricValue: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: '#f8fafc',
    } as React.CSSProperties,
    
    metricLabel: {
      fontSize: '0.75rem',
      color: '#64748b',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    } as React.CSSProperties,
    
    actionButtons: {
      display: 'flex',
      gap: '0.5rem',
    } as React.CSSProperties,
    
    actionBtn: {
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(148, 163, 184, 0.1)',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      borderRadius: '8px',
      color: '#94a3b8',
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
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      textAlign: 'center' as const,
      background: '#1e293b',
      borderRadius: '16px',
      border: '1px solid rgba(148, 163, 184, 0.1)',
    } as React.CSSProperties,
  };


  // Calculate stats
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.sent_count, 0);
  const totalReplies = campaigns.reduce((sum, c) => sum + c.replied_count, 0);
  const avgReplyRate = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : '0';


  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
          <p>Loading campaigns...</p>
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
            <Target size={24} />
          </div>
          <div>
            <h1 style={styles.title}>Campaigns</h1>
            <p style={styles.subtitle}>{totalCampaigns} campaigns • {activeCampaigns} active • {avgReplyRate}% avg reply rate</p>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnSecondary} onClick={loadData}>
            <RefreshCw size={18} />
            Refresh
          </button>
          <button style={styles.btnPrimary}>
            <Plus size={18} />
            New Campaign
          </button>
        </div>
      </div>


      {/* Tabs */}
      <div style={styles.tabs}>
        <button 
          style={activeTab === 'campaigns' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('campaigns')}
        >
          <Mail size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Campaigns
        </button>
        <button 
          style={activeTab === 'icps' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('icps')}
        >
          <Users size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          ICPs
        </button>
      </div>


      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{totalCampaigns}</p>
          <p style={styles.statLabel}>Total Campaigns</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statValue}>{totalSent}</p>
          <p style={styles.statLabel}>Emails Sent</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statValue, color: '#22c55e' }}>{totalReplies}</p>
          <p style={styles.statLabel}>Replies</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statValue, color: '#6366f1' }}>{avgReplyRate}%</p>
          <p style={styles.statLabel}>Reply Rate</p>
        </div>
      </div>


      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <div style={styles.emptyState}>
          <Target size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
          <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>No campaigns yet</h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Create your first campaign to start reaching out to prospects.</p>
          <button style={styles.btnPrimary}>
            <Plus size={18} />
            Create Campaign
          </button>
        </div>
      ) : (
        campaigns.map((campaign) => (
          <div 
            key={campaign.id} 
            style={styles.campaignCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={styles.campaignHeader}>
              <div>
                <h3 style={styles.campaignName}>{campaign.name}</h3>
                <div style={styles.campaignMeta}>
                  <Calendar size={14} />
                  Created {formatDate(campaign.created_at)}
                  {campaign.scheduled_at && (
                    <span> • Scheduled {formatDate(campaign.scheduled_at)}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={styles.statusBadge(campaign.status)}>{campaign.status}</span>
                <div style={styles.actionButtons}>
                  <button style={styles.actionBtn} title="View">
                    <Eye size={16} />
                  </button>
                  {campaign.status === 'active' ? (
                    <button style={styles.actionBtn} title="Pause">
                      <Pause size={16} />
                    </button>
                  ) : (
                    <button style={styles.actionBtn} title="Start">
                      <Play size={16} />
                    </button>
                  )}
                  <button style={styles.actionBtn} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
            
            <div style={styles.metricsRow}>
              <div style={styles.metric}>
                <p style={styles.metricValue}>{campaign.target_count}</p>
                <p style={styles.metricLabel}>Targeted</p>
              </div>
              <div style={styles.metric}>
                <p style={styles.metricValue}>{campaign.sent_count}</p>
                <p style={styles.metricLabel}>Sent</p>
              </div>
              <div style={styles.metric}>
                <p style={{ ...styles.metricValue, color: '#f59e0b' }}>{campaign.opened_count}</p>
                <p style={styles.metricLabel}>Opened</p>
              </div>
              <div style={styles.metric}>
                <p style={{ ...styles.metricValue, color: '#22c55e' }}>{campaign.replied_count}</p>
                <p style={styles.metricLabel}>Replied</p>
              </div>
            </div>
          </div>
        ))
      )}


      {/* Contact Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  );
}
