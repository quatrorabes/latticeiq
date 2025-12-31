
import Card from '@components/Card'
import { useAuth } from '@hooks/useAuth'

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and integrations</p>
      </div>

      <Card variant="elevated">
        <h2 className="text-lg font-bold text-white mb-4">Account</h2>
        <div className="space-y-4">
          <div>
            <p className="text-slate-400 text-sm">Email</p>
            <p className="text-white font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">User ID</p>
            <p className="text-white font-mono text-sm break-all">{user?.id}</p>
          </div>
        </div>
      </Card>

      <Card variant="elevated">
        <h2 className="text-lg font-bold text-white mb-4">CRM Integrations</h2>
        <p className="text-slate-400 text-sm">Coming soon...</p>
      </Card>
    </div>
  )
}