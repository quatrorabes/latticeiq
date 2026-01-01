/**
 * LeadTierBadge.tsx - Score Display Component
 * 
 * Displays lead scores with framework name and visual tier indicator
 * Status: PRODUCTION READY
 */

import React from 'react';

interface LeadTierBadgeProps {
  score: number;
  tier?: string;
  framework: 'MDCP' | 'BANT' | 'SPICE';
}

const LeadTierBadge: React.FC<LeadTierBadgeProps> = ({ score, tier, framework }) => {
  const getTierColor = () => {
    if (tier === 'hot' || score >= 71) return 'hot';
    if (tier === 'warm' || (score >= 40 && score < 71)) return 'warm';
    if (tier === 'cold' || score < 40) return 'cold';
    return 'gray';
  };

  const getTierEmoji = () => {
    const color = getTierColor();
    if (color === 'hot') return '🔥';
    if (color === 'warm') return '🟡';
    if (color === 'cold') return '❄️';
    return '◯';
  };

  return (
    <div className={`lead-tier-badge tier-${getTierColor()}`}>
      <span className="tier-emoji">{getTierEmoji()}</span>
      <span className="framework-name">{framework}</span>
      <span className="score-value">{Math.round(score)}</span>
    </div>
  );
};

export default LeadTierBadge;
