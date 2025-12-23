// frontend/src/pages/EnrichmentPage.tsx
import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

interface EnrichmentStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface EnrichmentContact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  company: string;
  enrichmentstatus: string;
  enrichedat?: string;
  enrichmentdata?: Record<string, any>;
}

export default function EnrichmentPage() {
  const [stats, setStats] = useState<EnrichmentStats>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });
  const [contacts, setContacts] = useState<EnrichmentContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    fetchEnrichmentData();
    const interval = setInterval(fetchEnrichmentData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchEnrichmentData = async () => {
    try {
      const response = await apiClient.get('/api/v3/contacts?limit=1000');
      const allContacts = response.data.contacts || [];

      // Calculate stats
      const newStats = {
        pending: allContacts.filter((c: any) => c.enrichmentstatus === 'pending').length,
        processing: allContacts.filter((c: any) => c.enrichmentstatus === 'processing').length,
        completed: allContacts.filter((c: any) => c.enrichmentstatus === 'completed').length,
        failed: allContacts.filter((c: any) => c.enrichmentstatus === 'failed').length,
      };
      setStats(newStats);

      // Filter contacts
      let filtered = allContacts;
      if (filter !== 'all') {
        filtered = allContacts.filter((c: any) => c.enrichmentstatus === filter);
      }

      // Sort by enrichedat desc
      filtered.sort((a: any, b: any) => {
        const aDate = new Date(a.enrichedat || 0).getTime();
        const bDate = new Date(b.enrichedat || 0).getTime();
        return bDate - aDate;
      });

      setContacts(filtered);
    } catch (err) {
      console.error('Error fetching enrichment data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrichAll = async () => {
    try {
      setEnriching(true);
      const pendingIds = contacts.filter((c) => c.enrichmentstatus === 'pending').map((c) => c.id);
      
      for (const id of pendingIds) {
        await apiClient.post(`/api/v3/enrichment/enrich/${id}`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Throttle requests
      }

      setTimeout(() => {
        fetchEnrichmentData();
        setEnriching(false);
      }, 2000);
    } catch (err) {
      console.error('Error enriching:', err);
      setEnriching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-green-900/30 text-green-300 px-3 py-1 rounded text-sm">✓ Completed</span>;
      case 'processing':
        return <span className="bg-yellow-900/30 text-yellow-300 px-3 py-1 rounded text-sm animate-pulse">⟳ Processing</span>;
      case 'failed':
        return <span className="bg-red-900/30 text-red-300 px-3 py-1 rounded text-sm">✗ Failed</span>;
      default:
        return <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm">⏳ Pending</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Enrichment Pipeline</h1>
          <p className="text-gray-400 mt-2">Monitor contact enrichment progress</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Pending</p>
            <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Processing</p>
            <p className="text-3xl font-bold text-blue-400 animate-pulse">{stats.processing}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Completed</p>
            <p className="text-3xl font-bold text-green-400">{stats.completed}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Failed</p>
            <p className="text-3xl font-bold text-red-400">{stats.failed}</p>
          </div>
        </div>

        {/* Filter & Actions */}
        <div className="mb-6 flex gap-4">
          <div className="flex gap-2">
            {(['all', 'pending', 'completed', 'failed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded transition capitalize ${
                  filter === status
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <button
            onClick={handleEnrichAll}
            disabled={enriching || stats.pending === 0}
            className="ml-auto bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-6 py-2 rounded transition font-medium"
          >
            {enriching ? 'Enriching...' : `Enrich All (${stats.pending})`}
          </button>
        </div>

        {/* Contacts List */}
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-gray-900 rounded-lg p-4 border border-gray-700 flex items-center justify-between hover:border-gray-600 transition"
            >
              <div className="flex-1">
                <p className="text-white font-medium">
                  {contact.firstname} {contact.lastname}
                </p>
                <p className="text-gray-400 text-sm">{contact.company}</p>
                <p className="text-gray-500 text-xs">{contact.email}</p>
              </div>
              <div className="flex items-center gap-4">
                {contact.enrichedat && (
                  <p className="text-gray-500 text-sm">
                    {new Date(contact.enrichedat).toLocaleDateString()}
                  </p>
                )}
                {getStatusBadge(contact.enrichmentstatus)}
              </div>
            </div>
          ))}
        </div>

        {contacts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No contacts with {filter !== 'all' ? filter + ' ' : ''}status.
          </div>
        )}
      </div>
    </div>
  );
}
