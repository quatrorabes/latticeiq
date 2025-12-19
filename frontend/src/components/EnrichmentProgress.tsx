// Enrichment Progress Display
import { EnrichmentStatus } from '../services/enrichmentService';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';

interface EnrichmentProgressProps {
  status: EnrichmentStatus | null;
}

const DOMAINS = [
  { key: 'COMPANY', label: 'Company Intel', icon: '🏢' },
  { key: 'PERSON', label: 'Person Research', icon: '👤' },
  { key: 'INDUSTRY', label: 'Industry Trends', icon: '📊' },
  { key: 'NEWS', label: 'Recent News', icon: '📰' },
  { key: 'OPEN_ENDED', label: 'Sales Angles', icon: '🎯' }
];

export function EnrichmentProgress({ status }: EnrichmentProgressProps) {
  if (!status) return null;
  
  const completed = new Set(status.domains_completed || []);
  const pending = new Set(status.domains_pending || []);
  
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Enrichment Progress</h4>
      <div className="space-y-2">
        {DOMAINS.map((domain) => {
          const isCompleted = completed.has(domain.key);
          const isPending = pending.has(domain.key);
          const isProcessing = !isCompleted && !isPending && status.status === 'processing';
          
          return (
            <div 
              key={domain.key}
              className="flex items-center gap-3 text-sm"
            >
              <span className="text-lg">{domain.icon}</span>
              <span className={`flex-1 ${isCompleted ? 'text-green-700' : 'text-gray-600'}`}>
                {domain.label}
              </span>
              {isCompleted ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : isProcessing ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
