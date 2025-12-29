// frontend/src/components/Sidebar.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/contacts', label: 'Contacts', icon: '👥' },
    { path: '/scoring-config', label: 'Scoring Config', icon: '⚙️' },
    { path: '/settings', label: 'Settings', icon: '🔧' },
  ];

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-gray-900 dark:bg-gray-950 border-r border-gray-800 dark:border-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-800 dark:border-gray-900">
        <h1 className="text-2xl font-bold text-white">LatticeIQ</h1>
        <p className="text-xs text-gray-400 mt-1">Sales Intelligence</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              isActive(item.path)
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-300 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-800'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-800 dark:border-gray-900">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
        >
          <LogOut size={16} />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
