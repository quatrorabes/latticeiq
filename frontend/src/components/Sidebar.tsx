// frontend/src/components/Sidebar.tsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/contacts', label: 'Contacts', icon: '👥' },
    { path: '/scoring', label: 'Lead Scoring', icon: '⭐' },
    { path: '/enrichment', label: 'Enrichment', icon: '✨' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-gray-900 border-r border-gray-700 flex flex-col transition-all duration-300`}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-700 flex items-center justify-between">
        {!isCollapsed && <h1 className="text-xl font-bold text-cyan-400">LatticeIQ</h1>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-400 hover:text-white transition"
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded transition ${
              isActive(item.path)
                ? 'bg-cyan-600/20 text-cyan-400 border-l-2 border-cyan-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={isCollapsed ? item.label : ''}
          >
            <span className="text-lg">{item.icon}</span>
            {!isCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onLogout}
          className="w-full px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-300 rounded transition text-sm"
        >
          {isCollapsed ? '📤' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
