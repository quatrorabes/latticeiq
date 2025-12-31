
import Card from '@components/Card'
import { FRAMEWORKS } from '@lib/constants'

export default function ScoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Lead Scoring</h1>
        <p className="text-slate-400">Understand qualification frameworks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(FRAMEWORKS).map(([key, framework]) => (
          <Card key={key} variant="elevated">
            <h3 className="text-lg font-bold text-white mb-2">{framework.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{framework.full_name}</p>
            <p className="text-slate-300 text-sm mb-4">{framework.description}</p>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-slate-400">Hot</p>
                <p className="text-primary-400 font-bold">{framework.hot_threshold}+</p>
              </div>
              <div>
                <p className="text-slate-400">Warm</p>
                <p className="text-warning font-bold">{framework.warm_threshold}+</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}