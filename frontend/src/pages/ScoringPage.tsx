import Card from '@components/Card'
import { FRAMEWORKS } from '@lib/constants'

interface Framework {
  id: string
  name: string
  full_name: string
  description: string
  hot_threshold: number
  warm_threshold: number
  dimensions: string[]
}

export default function ScoringPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Scoring Frameworks</h1>
        <p className="text-slate-400">Configure lead qualification frameworks for your sales process.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {FRAMEWORKS.map((framework: Framework) => (
          <Card key={framework.id} variant="elevated">
            <h3 className="text-lg font-bold text-white mb-2">{framework.name}</h3>
            <p className="text-slate-400 text-sm mb-4">{framework.full_name}</p>
            <p className="text-slate-300 text-sm mb-4">{framework.description}</p>
            
            <div className="flex gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase">Hot</p>
                <p className="text-cyan-400 font-bold">{framework.hot_threshold}+</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase">Warm</p>
                <p className="text-amber-400 font-bold">{framework.warm_threshold}+</p>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-500 uppercase mb-2">Dimensions</p>
              <div className="flex flex-wrap gap-2">
                {framework.dimensions.map((dim: string) => (
                  <span
                    key={dim}
                    className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300"
                  >
                    {dim}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
