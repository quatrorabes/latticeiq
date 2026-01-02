import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Upload,
  ListFilter,
  LayoutGrid,
  Sparkles,
  Zap,
  Target,
  Crosshair,
  Settings,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import '../styles/Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/contacts', icon: Users, label: 'Contacts' },
    { path: '/smart-lists', icon: ListFilter, label: 'Smart Lists' },
    { path: '/pipeline', icon: LayoutGrid, label: 'Pipeline' },
    { path: '/ai-writer', icon: Sparkles, label: 'AI Writer' },
    { path: '/campaigns', icon: Zap, label: 'Campaigns' }, // NEW - ADD THIS
    { path: '/crm', icon: Upload, label: 'CRM Import' },
    { path: '/integrations', icon: Zap, label: 'Integrations' },
    { path: '/scoring', icon: Target, label: 'Scoring' },
    { path: '/icps', icon: Crosshair, label: 'ICPs' }, // NEW
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">⚡</div>
            {sidebarOpen && <span className="logo-text">LatticeIQ</span>}
          </div>
          <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
