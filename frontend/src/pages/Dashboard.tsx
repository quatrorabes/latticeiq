import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, DollarSign, Target, Sparkles, LayoutGrid, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { fetchContacts, Contact } from '../api/contacts';
import '../styles/Dashboard.css';

interface DashboardStats {
  totalContacts: number;
  enriched: number;
  hotLeads: number;
  pipelineValue: number;
  avgScore: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    enriched: 0,
    hotLeads: 0,
    pipelineValue: 0,
    avgScore: 0
  });
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetchContacts(1000, 0);
      const contacts = response.contacts || [];
      
      // Calculate stats
      const enriched = contacts.filter(c => c.enrichment_status === 'completed').length;
      const hotLeads = contacts.filter(c => c.mdcp_tier === 'hot').length;
      const pipelineValue = contacts.reduce((sum, c) => sum + (c.deal_value || 0), 0);
      const avgScore = contacts.length > 0 
        ? Math.round(contacts.reduce((sum, c) => sum + (c.overall_score || 0), 0) / contacts.length)
        : 0;

      setStats({
        totalContacts: contacts.length,
        enriched,
        hotLeads,
        pipelineValue,
        avgScore
      });

      // Get 5 most recent contacts
      const recent = contacts
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      setRecentContacts(recent);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (tier?: string) => {
    if (!tier) return '#6b7280';
    switch (tier?.toLowerCase()) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-state">
          <RefreshCw className="spin" size={48} />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Welcome Header */}
      <div className="dashboard-header">
        <div>
          <h1>Welcome back! 👋</h1>
          <p>Here's what's happening with your sales pipeline today</p>
        </div>
        <div className="header-date">
          <Clock size={20} />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon-wrapper">
            <Users size={32} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Contacts</span>
            <span className="stat-value">{stats.totalContacts}</span>
            <span className="stat-change positive">Live from database</span>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon-wrapper">
            <CheckCircle size={32} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Enriched</span>
            <span className="stat-value">{stats.enriched}</span>
            <span className="stat-change positive">
              {stats.totalContacts > 0 ? Math.round((stats.enriched / stats.totalContacts) * 100) : 0}% coverage
            </span>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon-wrapper">
            <TrendingUp size={32} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Hot Leads</span>
            <span className="stat-value">{stats.hotLeads}</span>
            <span className="stat-change positive">High priority</span>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon-wrapper">
            <DollarSign size={32} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Pipeline Value</span>
            <span className="stat-value">${(stats.pipelineValue / 1000).toFixed(0)}K</span>
            <span className="stat-change positive">Total value</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Quick Actions */}
        <div className="dashboard-section quick-actions-section">
          <h2>⚡ Quick Actions</h2>
          <div className="quick-actions-grid">
            <a href="/contacts" className="action-card">
              <div className="action-icon">
                <Users size={28} />
              </div>
              <div className="action-content">
                <h3>View Contacts</h3>
                <p>Manage your database</p>
              </div>
            </a>

            <a href="/smart-lists" className="action-card">
              <div className="action-icon">
                <Target size={28} />
              </div>
              <div className="action-content">
                <h3>Smart Lists</h3>
                <p>Segment your leads</p>
              </div>
            </a>

            <a href="/pipeline" className="action-card">
              <div className="action-icon">
                <LayoutGrid size={28} />
              </div>
              <div className="action-content">
                <h3>Pipeline</h3>
                <p>Track deal stages</p>
              </div>
            </a>

            <a href="/ai-writer" className="action-card">
              <div className="action-icon">
                <Sparkles size={28} />
              </div>
              <div className="action-content">
                <h3>AI Writer</h3>
                <p>Generate emails</p>
              </div>
            </a>
          </div>
        </div>

        {/* Recent Contacts */}
        <div className="dashboard-section recent-contacts-section">
          <div className="section-header">
            <h2>🆕 Recent Contacts</h2>
            <a href="/contacts" className="view-all-link">View All →</a>
          </div>
          <div className="recent-contacts-list">
            {recentContacts.length > 0 ? (
              recentContacts.map(contact => (
                <div key={contact.id} className="recent-contact-card">
                  <div className="contact-avatar">
                    {contact.first_name?.[0]}{contact.last_name?.[0]}
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">{contact.first_name} {contact.last_name}</div>
                    <div className="contact-company">{contact.company || 'No company'}</div>
                    <div className="contact-time">{getTimeAgo(contact.created_at)}</div>
                  </div>
                  {contact.overall_score && (
                    <div className="contact-score">
                      <div
                        className="score-badge"
                        style={{ backgroundColor: getScoreColor(contact.mdcp_tier) }}
                      >
                        {contact.overall_score}
                      </div>
                      <span className="score-tier">{(contact.mdcp_tier || 'COLD').toUpperCase()}</span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state-small">
                <p>No contacts yet. Import some to get started!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
