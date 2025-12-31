
import Card from '@components/Card'

export default function EnrichmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Enrichment Queue</h1>
        <p className="text-slate-400">Manage AI-powered enrichment tasks</p>
      </div>

      <Card variant="elevated" className="text-center py-12">
        <p className="text-slate-400 mb-2">No enrichment tasks</p>
        <p className="text-slate-500 text-sm">
          Go to Contacts and click the Enrich button to start enriching leads
        </p>
      </Card>
    </div>
  )
}