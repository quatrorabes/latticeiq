// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import StatsCard from '../components/StatsCard';
import SegmentCard from '../components/SegmentCard';
import { apiClient } from '../services/apiClient';

interface DashboardStats {
  totalContacts: number;
  enrichedContacts: number;
  highLeads: number;
  mediumLeads: number;
  lowLeads: number;
  hotLeadsList: Array<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    company: string;
    title: string;
    apexscore: number;
    enrichmentstatus: string;
  }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('Not authenticated');
        return;
      }

      // Fetch all contacts for this user
      const response = await apiClient.get('/api/v3/contacts?limit=1000');
      const contacts = response.data.contacts || [];

      // Calculate stats
      const enriched = contacts.filter((c: any) => c.enrichmentstatus === 'completed').length;
      const high = contacts.filter((c: any) => (c.apexscore || 0) >= 75).length;
      const medium = contacts.filter((c: any) => (c.apexscore || 0) >= 50 && (c.apexscore || 0) < 75).length;
      const low = contacts.filter((c: any) => (c.apexscore || 0) < 50).length;

      // Top hot leads (highest APEX scores, enriched)
      const hotLeads = contacts
        .filter((c: any) => c.enrichmentstatus === 'completed' && c.apexscore >= 75)
        .sort((a: any, b: any) => (b.apexscore || 0) - (a.apexscore || 0))
        .slice(0, 10);

      setStats({
        totalContacts: contacts.length,
        enrichedContacts: enriched,
        highLeads: high,
        mediumLeads: medium,
        lowLeads: low,
        hotLeadsList: hotLeads,
      });
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="bg-red-900/20 border border-red-500 text-red-100 p-4 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Today's Board</h1>
          <p className="text-gray-400 mt-2">Last updated: {new Date().toLocaleTimeString()}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <StatsCard
            title="Total Contacts"
            value={stats?.totalContacts || 0}
            icon="👥"
            trend={`+${stats?.enrichedContacts || 0} enriched`}
          />
          <StatsCard
            title="Enriched"
            value={stats?.enrichedContacts || 0}
            icon="✨"
            trend={`${stats?.totalContacts ? Math.round((stats.enrichedContacts / stats.totalContacts) * 100) : 0}%`}
          />
          <StatsCard
            title="Hot Leads"
            value={stats?.highLeads || 0}
            icon="🔥"
            trend="Score 75+"
          />
          <StatsCard
            title="Medium"
            value={stats?.mediumLeads || 0}
            icon="📊"
            trend="Score 50-74"
          />
          <StatsCard
            title="Low Priority"
            value={stats?.lowLeads || 0}
            icon="📋"
            trend="Score <50"
          />
        </div>

        {/* Hot Leads Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">🔥 Hot Leads</h2>
          
          {stats?.hotLeadsList && stats.hotLeadsList.length > 0 ? (
            <div className="space-y-3">
              {stats.hotLeadsList.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-gray-800 rounded p-4 flex items-center justify-between hover:bg-gray-750 transition"
                >
                  <div className="flex-1">
                    <p className="text-white font-medium">
                      {lead.firstname} {lead.lastname}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {lead.title} at {lead.company}
                    </p>
                    <p className="text-gray-500 text-xs">{lead.email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-cyan-400 font-bold text-lg">{lead.apexscore}/100</p>
                      <p className="text-gray-500 text-xs">APEX Score</p>
                    </div>
                    <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded transition">
                      Call
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No hot leads yet. Enrich some contacts to see them here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
