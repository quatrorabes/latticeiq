
import Card from '@components/Card'
import { BarChart3, Users, Zap, TrendingUp } from 'lucide-react'
import { useContacts } from '@hooks/useContacts'
import { useMemo } from 'react'

export default function DashboardPage() {
  const { contacts } = useContacts()

  const stats = useMemo(() => {
    const totalContacts = contacts.length
    const enrichedContacts = contacts.filter(c => c.enrichment_status === 'completed').length
    const avgScore = contacts.length > 0
      ? Math.round(contacts.reduce((sum, c) => sum + (c.apex_score || 0), 0) / contacts.length)
      : 0
    const hotLeads = contacts.filter(c => (c.apex_score || 0) >= 80).length

    return { totalContacts, enrichedContacts, avgScore, hotLeads }
  }, [contacts])

  const statCards = [
    {
      label: 'Total Contacts',
      value: stats.totalContacts,
      icon: Users,
      color: 'text-primary-400',
      bgColor: 'bg-primary-500/10',
    },
    {
      label: 'Enriched',
      value: stats.enrichedContacts,
      icon: Zap,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Avg Score',
      value: stats.avgScore,
      icon: BarChart3,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Hot Leads',
      value: stats.hotLeads,
      icon: TrendingUp,
      color: 'text-error',
      bgColor: 'bg-error/10',
    },
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
        <div className="text-slate-400 text-sm">
          <p>Feature coming soon...</p>
        </div>
      </Card>
    </div>
  )
}