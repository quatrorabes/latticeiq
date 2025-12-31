
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '@hooks/useAuth'
import { Moon, Sun } from 'lucide-react'

interface LayoutProps {
  darkMode: boolean
  onToggleDarkMode: () => void
}

export default function Layout({ darkMode, onToggleDarkMode }: LayoutProps) {
  const { logout } = useAuth()

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar onLogout={logout} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">LatticeIQ</h1>
          <button
            onClick={onToggleDarkMode}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </header>

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