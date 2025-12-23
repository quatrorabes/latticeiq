// frontend/src/pages/ScoringPage.tsx
import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

interface ScoringContact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  company: string;
  apexscore: number;
  mdcpscore: number;
  rssscore: number;
  enrichmentstatus: string;
  bant_budget: number;
  bant_authority: number;
  bant_need: number;
  bant_timeline: number;
  spice_score: number;
}

export default function ScoringPage() {
  const [contacts, setContacts] = useState<ScoringContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'apex' | 'mdcp' | 'spice'>('apex');

  useEffect(() => {
    fetchScoringData();
  }, []);

  const fetchScoringData = async () => {
    try {
      const response = await apiClient.get('/api/v3/contacts?limit=1000');
      const enrichedContacts = (response.data.contacts || [])
        .filter((c: any) => c.enrichmentstatus === 'completed' && c.apexscore)
        .map((c: any) => ({
          id: c.id,
          firstname: c.firstname,
          lastname: c.lastname,
          email: c.email,
          company: c.company,
          apexscore: c.apexscore || 0,
          mdcpscore: c.mdcpscore || 0,
          rssscore: c.rssscore || 0,
          enrichmentstatus: c.enrichmentstatus,
          bant_budget: c.enrichmentdata?.bant?.budget || 0,
          bant_authority: c.enrichmentdata?.bant?.authority || 0,
          bant_need: c.enrichmentdata?.bant?.need || 0,
          bant_timeline: c.enrichmentdata?.bant?.timeline || 0,
          spice_score: c.enrichmentdata?.spice_score || 0,
        }));

      // Sort by selected metric
      const sorted = enrichedContacts.sort((a: any, b: any) => {
        if (sortBy === 'apex') return b.apexscore - a.apexscore;
        if (sortBy === 'mdcp') return b.mdcpscore - a.mdcpscore;
        return b.spice_score - a.spice_score;
      });

      setContacts(sorted);
    } catch (err) {
      console.error('Error fetching scoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
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
          <h1 className="text-3xl font-bold text-white">Lead Scoring</h1>
          <p className="text-gray-400 mt-2">Comprehensive lead qualification analysis</p>
        </div>

        {/* Sort Options */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setSortBy('apex')}
            className={`px-4 py-2 rounded transition ${
              sortBy === 'apex'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            APEX Score
          </button>
          <button
            onClick={() => setSortBy('mdcp')}
            className={`px-4 py-2 rounded transition ${
              sortBy === 'mdcp'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            MDCP Score
          </button>
          <button
            onClick={() => setSortBy('spice')}
            className={`px-4 py-2 rounded transition ${
              sortBy === 'spice'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            SPICE Score
          </button>
        </div>

        {/* Scoring Table */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-white font-semibold">Contact</th>
                <th className="px-6 py-3 text-right text-white font-semibold">APEX</th>
                <th className="px-6 py-3 text-right text-white font-semibold">MDCP</th>
                <th className="px-6 py-3 text-right text-white font-semibold">SPICE</th>
                <th className="px-6 py-3 text-right text-white font-semibold">BANT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-800 transition">
                  <td className="px-6 py-3">
                    <div>
                      <p className="text-white font-medium">
                        {contact.firstname} {contact.lastname}
                      </p>
                      <p className="text-gray-400 text-sm">{contact.company}</p>
                    </div>
                  </td>
                  <td className={`px-6 py-3 text-right font-bold ${getScoreColor(contact.apexscore)}`}>
                    {contact.apexscore}/100
                  </td>
                  <td className={`px-6 py-3 text-right font-bold ${getScoreColor(contact.mdcpscore)}`}>
                    {contact.mdcpscore}/100
                  </td>
                  <td className={`px-6 py-3 text-right font-bold ${getScoreColor(contact.spice_score)}`}>
                    {contact.spice_score}/100
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-gray-300">
                      B: {contact.bant_budget} | A: {contact.bant_authority} | N: {contact.bant_need} | T: {contact.bant_timeline}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {contacts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No scored contacts yet. Enrich contacts to see scoring results.
          </div>
        )}
      </div>
    </div>
  );
}
