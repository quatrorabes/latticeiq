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
    { label: '📊 Analytics', path: '/premium/dashboard' },
    { label: 'Enrichment', path: '/enrichment' },
    { label: 'Scoring', path: '/scoring' },
    { label: 'CRM Import', path: '/crm' },
    { label: 'Settings', path: '/settings' },
  ]

  return (
    <div className={`flex h-screen ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo/Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          {sidebarOpen && <span className="font-bold text-lg">LatticeIQ</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-800 rounded"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block px-4 py-2 rounded hover:bg-gray-800 transition-colors text-sm"
              title={!sidebarOpen ? item.label : ''}
            >
              {sidebarOpen ? item.label : item.label.charAt(0)}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 space-y-2">
          <button
            onClick={onToggleDarkMode}
            className="w-full px-4 py-2 rounded hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            {sidebarOpen && <span className="text-sm">{darkMode ? 'Light' : 'Dark'}</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 rounded bg-red-600 hover:bg-red-700 transition-colors text-sm"
          >
            {sidebarOpen ? 'Logout' : '←'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            LatticeIQ - Sales Intelligence Platform
          </h1>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
