import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Menu, X, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

interface LayoutProps {
  darkMode: boolean
  onToggleDarkMode: () => void
}

export default function Layout({ darkMode, onToggleDarkMode }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Contacts', path: '/contacts' },
    { label: 'Enrichment', path: '/enrichment' },
    { label: 'Scoring', path: '/scoring' },
    { label: 'Settings', path: '/settings' },
  ]

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="flex h-screen bg-slate-950 text-slate-50">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-slate-900 border-r border-slate-700 transition-all duration-300 flex flex-col`}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            {sidebarOpen && <h1 className="text-lg font-bold text-cyan-400">LatticeIQ</h1>}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-md transition-colors"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="block px-4 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm"
              >
                {sidebarOpen && item.label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            <button
              onClick={onToggleDarkMode}
              className="w-full px-4 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm flex items-center justify-center gap-2"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              {sidebarOpen && (darkMode ? 'Light' : 'Dark')}
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 rounded-md hover:bg-red-900/20 text-red-400 transition-colors text-sm"
            >
              {sidebarOpen ? 'Logout' : '⎋'}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
