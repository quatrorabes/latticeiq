import React, { useState, useEffect } from 'react';
import { LayoutGrid, Plus, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import '../styles/PipelinePage.css';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  title?: string;
  mdcp_score?: number;
  deal_value?: number;
  pipeline_stage: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  icon: string;
  contacts: Contact[];
  count: number;
  total_value: number;
}

const DEFAULT_STAGES = [
  { id: 'new', name: 'New', color: '#6b7280', icon: '📥' },
  { id: 'contacted', name: 'Contacted', color: '#3b82f6', icon: '📧' },
  { id: 'qualified', name: 'Qualified', color: '#8b5cf6', icon: '✅' },
  { id: 'meeting', name: 'Meeting', color: '#f59e0b', icon: '📅' },
  { id: 'proposal', name: 'Proposal', color: '#ec4899', icon: '📄' },
  { id: 'negotiation', name: 'Negotiation', color: '#ef4444', icon: '🤝' },
  { id: 'won', name: 'Closed Won', color: '#10b981', icon: '🎉' },
  { id: 'lost', name: 'Closed Lost', color: '#dc2626', icon: '❌' },
];

export const PipelinePage: React.FC = () => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [stats, setStats] = useState({
    total_contacts: 0,
    total_value: 0,
    win_rate: 0,
    avg_deal_size: 0
  });

  useEffect(() => {
    loadPipeline();
  }, []);

  const loadPipeline = async () => {
    setLoading(true);
    try {
      // In production: const response = await fetch('/api/v3/pipeline/board');
      // Mock data for demo
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockStages: Stage[] = DEFAULT_STAGES.map(stage => ({
        ...stage,
        contacts: stage.id === 'new' ? [
          {
            id: '1',
            first_name: 'John',
            last_name: 'Smith',
            email: 'john@acme.com',
            company: 'Acme Inc',
            title: 'VP Sales',
            mdcp_score: 85,
            deal_value: 50000,
            pipeline_stage: 'new'
          },
          {
            id: '2',
            first_name: 'Sarah',
            last_name: 'Johnson',
            email: 'sarah@techcorp.com',
            company: 'TechCorp',
            title: 'CEO',
            mdcp_score: 92,
            deal_value: 120000,
            pipeline_stage: 'new'
          }
        ] : stage.id === 'meeting' ? [
          {
            id: '3',
            first_name: 'Mike',
            last_name: 'Chen',
            email: 'mike@startup.io',
            company: 'Startup Inc',
            title: 'Founder',
            mdcp_score: 78,
            deal_value: 75000,
            pipeline_stage: 'meeting'
          }
        ] : [],
        count: stage.id === 'new' ? 2 : stage.id === 'meeting' ? 1 : 0,
        total_value: stage.id === 'new' ? 170000 : stage.id === 'meeting' ? 75000 : 0
      }));
      
      setStages(mockStages);
      setStats({
        total_contacts: 3,
        total_value: 245000,
        win_rate: 42,
        avg_deal_size: 81667
      });
    } catch (err) {
      console.error('Failed to load pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (contact: Contact) => {
    setDraggedContact(contact);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stageId: string) => {
    if (!draggedContact) return;

    try {
      // In production: await moveContact(draggedContact.id, stageId);
      
      // Update UI optimistically
      setStages(prevStages =>
        prevStages.map(stage => ({
          ...stage,
          contacts: stage.id === stageId
            ? [...stage.contacts, { ...draggedContact, pipeline_stage: stageId }]
            : stage.contacts.filter(c => c.id !== draggedContact.id),
          count: stage.id === stageId ? stage.count + 1 : stage.count - 1
        }))
      );
      
      setDraggedContact(null);
    } catch (err) {
      console.error('Failed to move contact:', err);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="pipeline-page">
        <div className="loading-state">
          <RefreshCw className="spin" size={48} />
          <p>Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pipeline-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-main">
          <LayoutGrid size={32} />
          <div>
            <h1>Sales Pipeline</h1>
            <p>Visual pipeline management with drag-and-drop stages</p>
          </div>
        </div>
        <button className="btn-secondary" onClick={loadPipeline}>
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="pipeline-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <LayoutGrid size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Contacts</span>
            <span className="stat-value">{stats.total_contacts}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pipeline Value</span>
            <span className="stat-value">{formatCurrency(stats.total_value)}</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Win Rate</span>
            <span className="stat-value">{stats.win_rate}%</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Avg Deal Size</span>
            <span className="stat-value">{formatCurrency(stats.avg_deal_size)}</span>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="kanban-board">
        {stages.map(stage => (
          <div
            key={stage.id}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(stage.id)}
          >
            {/* Column Header */}
            <div className="column-header" style={{ borderTopColor: stage.color }}>
              <div className="column-title">
                <span className="column-icon">{stage.icon}</span>
                <span className="column-name">{stage.name}</span>
                <span className="column-count">{stage.count}</span>
              </div>
              <div className="column-value">{formatCurrency(stage.total_value)}</div>
            </div>

            {/* Contacts */}
            <div className="column-contacts">
              {stage.contacts.length === 0 ? (
                <div className="empty-column">
                  <p>Drop contacts here</p>
                </div>
              ) : (
                stage.contacts.map(contact => (
                  <div
                    key={contact.id}
                    className="contact-card-kanban"
                    draggable
                    onDragStart={() => handleDragStart(contact)}
                  >
                    <div className="contact-header">
                      <div className="contact-avatar">
                        {contact.first_name?.[0]}{contact.last_name?.[0]}
                      </div>
                      <div className="contact-info">
                        <h4>{contact.first_name} {contact.last_name}</h4>
                        <p>{contact.company}</p>
                      </div>
                    </div>
                    
                    <div className="contact-meta">
                      <div className="contact-score">
                        <span className="score-badge">{contact.mdcp_score}</span>
                        <span className="score-label">MDCP</span>
                      </div>
                      {contact.deal_value && (
                        <div className="contact-value">
                          {formatCurrency(contact.deal_value)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PipelinePage;
