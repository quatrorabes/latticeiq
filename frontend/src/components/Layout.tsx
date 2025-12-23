// frontend/src/components/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom';

export default function Layout() {
  const navItems = [
    { to: '/contacts', label: '👥 Contacts' },
    { to: '/dashboard', label: '📊 Dashboard' },
    { to: '/enrichment', label: '✨ Enrichment' },
    { to: '/settings', label: '⚙️ Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-cyan-400">LatticeIQ</h1>
          <p className="text-gray-400 text-sm">Sales Intelligence</p>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
