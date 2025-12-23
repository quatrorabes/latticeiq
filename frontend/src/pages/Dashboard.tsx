// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface DashboardStats {
  totalContacts: number;
  enrichedContacts: number;
  avgMdcpScore: number;
  avgBantScore: number;
  highPriorityLeads: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    enrichedContacts: 0,
    avgMdcpScore: 0,
    avgBantScore: 0,
    highPriorityLeads: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*');

      if (error) throw error;

      const totalContacts = contacts?.length || 0;
      const enrichedContacts = contacts?.filter(c => c.enrichment_status === 'enriched').length || 0;
      const withMdcp = contacts?.filter(c => c.mdcp_score) || [];
      const withBant = contacts?.filter(c => c.bant_score) || [];
      const avgMdcpScore = withMdcp.length > 0 
        ? Math.round(withMdcp.reduce((sum, c) => sum + (c.mdcp_score || 0), 0) / withMdcp.length)
        : 0;
      const avgBantScore = withBant.length > 0
        ? Math.round(withBant.reduce((sum, c) => sum + (c.bant_score || 0), 0) / withBant.length)
        : 0;
      const highPriorityLeads = contacts?.filter(c => (c.mdcp_score || 0) >= 80).length || 0;

      setStats({
        totalContacts,
        enrichedContacts,
        avgMdcpScore,
        avgBantScore,
        highPriorityLeads,
      });
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Contacts" value={stats.totalContacts} color="cyan" />
        <StatCard title="Enriched" value={stats.enrichedContacts} color="green" />
        <StatCard title="Avg MDCP" value={stats.avgMdcpScore} color="purple" />
        <StatCard title="Avg BANT" value={stats.avgBantScore} color="orange" />
        <StatCard title="High Priority" value={stats.highPriorityLeads} color="red" />
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <a href="/contacts" className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors">
            View Contacts
          </a>
          <a href="/enrichment" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
            Enrich Leads
          </a>
          <a href="/scoring" className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors">
            Score Leads
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    cyan: 'border-cyan-500 text-cyan-400',
    green: 'border-green-500 text-green-400',
    purple: 'border-purple-500 text-purple-400',
    orange: 'border-orange-500 text-orange-400',
    red: 'border-red-500 text-red-400',
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border-l-4 ${colorClasses[color]}`}>
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
