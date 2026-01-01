/**
 * ContactStatsCard.tsx - Statistics Display Card
 * 
 * Reusable card for displaying key metrics
 * Status: PRODUCTION READY
 */

import React from 'react';

interface ContactStatsCardProps {
  title: string;
  value: string | number;
  color?: 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'orange';
  icon?: string;
  onClick?: () => void;
}

const ContactStatsCard: React.FC<ContactStatsCardProps> = ({
  title,
  value,
  color = 'blue',
  icon,
  onClick,
}) => {
  return (
    <div
      className={`stats-card stats-${color}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {icon && <span className="stats-icon">{icon}</span>}
      <h4 className="stats-title">{title}</h4>
      <p className="stats-value">{value}</p>
    </div>
  );
};

export default ContactStatsCard;
