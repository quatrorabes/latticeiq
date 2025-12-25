import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

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
    <div className={`flex flex-col h-screen bg-gray-900 border-r border-gray-700 transition-all ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!isCollapsed && <h1 className="text-xl font-bold text-cyan-400">LatticeIQ</h1>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-gray-800 rounded"
        >
          {isCollapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded transition-colors ${
              isActive(item.path)
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-400 rounded transition-colors"
        >
          <span>🚪</span>
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );
}
