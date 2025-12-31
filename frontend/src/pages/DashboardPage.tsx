import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Users, Zap, TrendingUp, ArrowRight } from 'lucide-react'
import Card from '@components/Card'
import { useContacts } from '@hooks/useContacts'

export default function DashboardPage() {
  const { contacts, loading } = useContacts()

  const stats = useMemo(() => {
    const totalContacts = contacts.length
    const enrichedContacts = contacts.filter((c) => c.enrichment_status === 'completed').length
    const avgScore = contacts.length > 0 ? Math.round(contacts.reduce((sum, c) => sum + (c.overall_score || c.apex_score || 0), 0) / contacts.length) : 0
    const hotLeads = contacts.filter((c) => (c.overall_score || c.apex_score || 0) >= 80).length
    return { totalContacts, enrichedContacts, avgScore, hotLeads }
  }, [contacts])

  const statCards = [
    {
      label: 'Total Contacts',
      value: stats.totalContacts,
      icon: Users,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      label: 'Enriched',
      value: stats.enrichedContacts,
      icon: Zap,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Avg Score',
      value: stats.avgScore,
      icon: BarChart3,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Hot Leads',
      value: stats.hotLeads,
      icon: TrendingUp,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Overview of your contacts and enrichment progress.</p>
        </div>

        <Link
          to="/contacts"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700 transition-colors"
        >
          Go to Contacts <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <Card variant="elevated" className="py-10 text-center">
          <p className="text-slate-400">Loading stats...</p>
        </Card>
      ) : (
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
      )}

      <Card variant="elevated">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Next actions</h2>
            <p className="text-slate-400 text-sm">
              Enrich contacts to generate talking points, BANT, and an APEX score.
            </p>
          </div>

          <Link
            to="/contacts"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Enrich now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Card>
    </div>
  )
}
