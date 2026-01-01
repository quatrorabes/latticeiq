import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, DollarSign, Target, Sparkles, LayoutGrid, Clock, CheckCircle } from 'lucide-react';
import '../styles/Dashboard.css';

interface DashboardStats {
  totalContacts: number;
  enriched: number;
  hotLeads: number;
  pipelineValue: number;
  avgScore: number;
  recentActivity: number;
}

interface RecentContact {
  id: string;
  name: string;
  company: string;
  score: number;
  tier: string;
  addedAt: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 234,
    enriched: 156,
    hotLeads: 42,
    pipelineValue: 1250000,
    avgScore: 68,
    recentActivity: 24
  });

  const [recentContacts] = useState<RecentContact[]>([
    { id: '1', name: 'John Smith', company: 'Acme Inc', score: 85, tier: 'hot', addedAt: '2 hours ago' },
    { id: '2', name: 'Sarah Johnson', company: 'TechCorp', score: 92, tier: 'hot', addedAt: '5 hours ago' },
    { id: '3', name: 'Mike Chen', company: 'Startup Inc', score: 58, tier: 'warm', addedAt: '1 day ago' },
  ]);

  const getScoreColor = (tier: string) => {
    switch (tier) {
      case 'hot': return '#ef4444';
      case 'warm': return '#f59e0b';
      case 'cold': return '#3b82f6';
      default: return '#6b7280';
    }
  };

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
            <span className="stat-change positive">+12% from last month</span>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon-wrapper">
            <CheckCircle size={32} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Enriched</span>
            <span className="stat-value">{stats.enriched}</span>
            <span className="stat-change positive">{Math.round((stats.enriched / stats.totalContacts) * 100)}% coverage</span>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon-wrapper">
            <TrendingUp size={32} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Hot Leads</span>
            <span className="stat-value">{stats.hotLeads}</span>
            <span className="stat-change positive">+8 this week</span>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon-wrapper">
            <DollarSign size={32} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Pipeline Value</span>
            <span className="stat-value">${(stats.pipelineValue / 1000).toFixed(0)}K</span>
            <span className="stat-change positive">+18% growth</span>
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
            {recentContacts.map(contact => (
              <div key={contact.id} className="recent-contact-card">
                <div className="contact-avatar">
                  {contact.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="contact-info">
                  <div className="contact-name">{contact.name}</div>
                  <div className="contact-company">{contact.company}</div>
                  <div className="contact-time">{contact.addedAt}</div>
                </div>
                <div className="contact-score">
                  <div
                    className="score-badge"
                    style={{ backgroundColor: getScoreColor(contact.tier) }}
                  >
                    {contact.score}
                  </div>
                  <span className="score-tier">{contact.tier.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="dashboard-section score-distribution-section">
        <h2>📊 Score Distribution</h2>
        <div className="score-bars">
          <div className="score-bar-item">
            <div className="score-bar-label">
              <span className="score-range">81-100</span>
              <span className="score-count">42 contacts</span>
            </div>
            <div className="score-bar-track">
              <div className="score-bar-fill hot" style={{ width: '42%' }}></div>
            </div>
          </div>

          <div className="score-bar-item">
            <div className="score-bar-label">
              <span className="score-range">61-80</span>
              <span className="score-count">68 contacts</span>
            </div>
            <div className="score-bar-track">
              <div className="score-bar-fill warm" style={{ width: '68%' }}></div>
            </div>
          </div>

          <div className="score-bar-item">
            <div className="score-bar-label">
              <span className="score-range">41-60</span>
              <span className="score-count">89 contacts</span>
            </div>
            <div className="score-bar-track">
              <div className="score-bar-fill medium" style={{ width: '89%' }}></div>
            </div>
          </div>

          <div className="score-bar-item">
            <div className="score-bar-label">
              <span className="score-range">0-40</span>
              <span className="score-count">35 contacts</span>
            </div>
            <div className="score-bar-track">
              <div className="score-bar-fill cold" style={{ width: '35%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
