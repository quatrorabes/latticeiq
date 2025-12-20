// frontend/src/components/ScoreCard.tsx

interface ScoreCardProps {
  title: string;
  score: number;
  maxScore?: number;
  subtitle?: string;
  icon?: string;
  variant?: 'apex' | 'bant' | 'spice' | 'default';
}

export default function ScoreCard({
  title,
  score,
  maxScore = 100,
  subtitle,
  icon,
  variant = 'default',
}: ScoreCardProps) {
  // Calculate percentage for visual indicator
  const percentage = (score / maxScore) * 100;

  // Determine color based on variant and score
  const getVariantClass = () => {
    switch (variant) {
      case 'apex':
        return 'from-primary-400 to-primary-500';
      case 'bant':
        return 'from-accent-500 to-accent-600';
      case 'spice':
        return 'from-accent-400 to-accent-500';
      default:
        return 'from-neutral-700 to-neutral-800';
    }
  };

  const getScoreColor = () => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className={`card bg-gradient-to-br ${getVariantClass()} overflow-hidden`}>
      <div className="relative">
        {/* Background accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10">
          {/* Header with icon and title */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-text-secondary opacity-90 uppercase tracking-wider">
                {icon && <span className="inline-block mr-2">{icon}</span>}
                {title}
              </p>
              {subtitle && (
                <p className="text-xs text-text-tertiary opacity-75 mt-1">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Score display */}
          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${getScoreColor()}`}>
                {Math.round(score)}
              </span>
              <span className="text-sm text-text-secondary opacity-75">
                / {maxScore}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-secondary-bg bg-opacity-20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-success to-success transition-all duration-300"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>

          {/* Status text */}
          <p className="text-xs text-text-secondary opacity-75 mt-3">
            {percentage >= 80 && 'Excellent match'}
            {percentage >= 60 && percentage < 80 && 'Good fit'}
            {percentage >= 40 && percentage < 60 && 'Moderate fit'}
            {percentage < 40 && 'Low fit'}
          </p>
        </div>
      </div>
    </div>
  );
}
