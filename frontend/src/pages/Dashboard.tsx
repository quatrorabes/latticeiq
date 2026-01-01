import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, DollarSign, Target } from 'lucide-react';
import '../styles/Dashboard.css';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalContacts: 0,
    enriched: 0,
    hotLeads: 0,
    pipelineValue: 0
  });

  useEffect(() => {
    // In production: fetch stats from API
    setStats({
      totalContacts: 234,
      enriched: 156,
      hotLeads: 42,
      pipelineValue: 1250000
    });
  }, []);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here's what's happening with your sales pipeline.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Contacts</span>
            <span className="stat-value">{stats.totalContacts}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Target size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Enriched</span>
            <span className="stat-value">{stats.enriched}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Hot Leads</span>
            <span className="stat-value">{stats.hotLeads}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pipeline Value</span>
            <span className="stat-value">
              ${(stats.pipelineValue / 1000).toFixed(0)}K
            </span>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <a href="/contacts" className="action-card">
            <Users size={32} />
            <h3>View Contacts</h3>
            <p>Manage your contact database</p>
          </a>
          <a href="/smart-lists" className="action-card">
            <Target size={32} />
            <h3>Smart Lists</h3>
            <p>Filter and segment leads</p>
          </a>
          <a href="/pipeline" className="action-card">
            <TrendingUp size={32} />
            <h3>Pipeline</h3>
            <p>Track deals through stages</p>
          </a>
          <a href="/ai-writer" className="action-card">
            <DollarSign size={32} />
            <h3>AI Writer</h3>
            <p>Generate outreach emails</p>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
