// frontend/src/components/StatusBadge.tsx

interface StatusBadgeProps {
  status: 'pending' | 'enriching' | 'completed' | 'failed';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export default function StatusBadge({
  status,
  size = 'md',
  animated = false,
}: StatusBadgeProps) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      icon: '⏳',
      class: 'badge-cold',
    },
    enriching: {
      label: 'Enriching...',
      icon: '⚙️',
      class: 'badge-info',
    },
    completed: {
      label: 'Completed',
      icon: '✅',
      class: 'badge-success',
    },
    failed: {
      label: 'Failed',
      icon: '❌',
      class: 'badge-error',
    },
  };

  const config = statusConfig[status];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : size === 'lg' ? 'text-base px-4 py-2' : 'text-sm px-3 py-1.5';

  return (
    <span
      className={`badge ${config.class} ${sizeClass} ${animated && status === 'enriching' ? 'animate-pulse' : ''}`}
    >
      <span className="inline-block mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
}
