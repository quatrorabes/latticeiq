/**
 * EnrichmentBadge.tsx - Enrichment Status Indicator
 * 
 * Visual indicator for enrichment progress status
 * Status: PRODUCTION READY
 */

import React from 'react';

interface EnrichmentBadgeProps {
  status?: string;
}

const EnrichmentBadge: React.FC<EnrichmentBadgeProps> = ({ status = 'pending' }) => {
  const statusConfigs = {
    completed: { emoji: '✓', label: 'Enriched', className: 'status-completed' },
    pending: { emoji: '⏳', label: 'Pending', className: 'status-pending' },
    processing: { emoji: '⚡', label: 'Processing', className: 'status-processing' },
    failed: { emoji: '✕', label: 'Failed', className: 'status-failed' },
  };

  const config = statusConfigs[status as keyof typeof statusConfigs] || statusConfigs.pending;

  return (
    <div className={`enrichment-badge ${config.className}`}>
      <span className="status-emoji">{config.emoji}</span>
      <span className="status-label">{config.label}</span>
    </div>
  );
};

export default EnrichmentBadge;
