import Card from '@components/Card'
import { BarChart3, Users, Zap, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const statCards = [
    { label: 'Total Contacts', value: 0, icon: Users, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    { label: 'Enriched', value: 0, icon: Zap, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    { label: 'Avg Score', value: 0, icon: BarChart3, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { label: 'Hot Leads', value: 0, icon: TrendingUp, color: 'text-red-400', bgColor: 'bg-red-500/10' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Overview of your sales intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} variant="elevated">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                  <p className="text-4xl font-bold text-white mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card variant="elevated">
        <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
        <p className="text-slate-400 text-sm">Feature coming soon...</p>
      </Card>
    </div>
  )
}
