import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Contact } from '../types/contact';

export default function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) {
      navigate('/contacts');
      return;
    }
    fetchContact();
  }, [contactId]);

  async function fetchContact() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await supabase.auth.getSession();
      const sess = result.data.session;
      if (!sess) {
        navigate('/login');
        return;
      }
      const res = await fetch(import.meta.env.VITE_API_URL + '/api/v3/contacts/' + contactId, {
        headers: { 'Authorization': 'Bearer ' + sess.access_token }
      });
      if (!res.ok) throw new Error('Contact not found');
      const data = await res.json();
      setContact(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading contact');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) return <div className="p-8 bg-slate-900 min-h-screen text-white">Loading...</div>;
  if (error) return <div className="p-8 bg-slate-900 min-h-screen text-red-400">{error}</div>;
  if (!contact) return <div className="p-8 bg-slate-900 min-h-screen text-white">Contact not found</div>;

  const enrichment = contact.enrichment_data as any || {};

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <button onClick={() => navigate('/contacts')} className="text-blue-400 hover:text-blue-300 mb-6">← Back to Contacts</button>
        
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{contact.first_name} {contact.last_name}</h1>
              <p className="text-slate-400 text-lg">{contact.job_title || 'Position Unknown'}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-400">{contact.apex_score?.toFixed(0) || 'N/A'}</div>
              <div className="text-sm text-slate-400">APEX Score</div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-slate-700">
            <div>
              <p className="text-slate-400 text-sm mb-1">Email</p>
              <p className="text-white font-medium">{contact.email}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Phone</p>
              <p className="text-white font-medium">{contact.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Company</p>
              <p className="text-white font-medium">{contact.company || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                contact.enrichment_status === 'completed' ? 'bg-green-900 text-green-200' :
                contact.enrichment_status === 'processing' ? 'bg-yellow-900 text-yellow-200' :
                contact.enrichment_status === 'failed' ? 'bg-red-900 text-red-200' :
                'bg-gray-900 text-gray-200'
              }`}>
                {contact.enrichment_status || 'pending'}
              </span>
            </div>
          </div>

          {/* LinkedIn & Website */}
          {(contact.linkedin_url || contact.website) && (
            <div className="mb-8 pb-8 border-b border-slate-700">
              <p className="text-slate-400 text-sm mb-3">Links</p>
              <div className="flex gap-4">
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 underline">LinkedIn</a>
                )}
                {contact.website && (
                  <a href={contact.website} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline">Website</a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Enrichment Data */}
        {contact.enrichment_status === 'completed' && Object.keys(enrichment).length > 0 && (
          <div className="space-y-8">
            
            {/* Summary */}
            {enrichment.summary && (
              <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-4">Summary</h2>
                <p className="text-slate-300 leading-relaxed">{enrichment.summary}</p>
              </div>
            )}

            {/* Key Information */}
            <div className="grid grid-cols-2 gap-6">
              {enrichment.vertical && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <p className="text-slate-400 text-sm mb-2">Vertical</p>
                  <p className="text-white font-semibold text-lg">{enrichment.vertical}</p>
                </div>
              )}
              {enrichment.persona_type && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <p className="text-slate-400 text-sm mb-2">Persona Type</p>
                  <p className="text-white font-semibold text-lg">{enrichment.persona_type}</p>
                </div>
              )}
              {enrichment.inferred_seniority && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <p className="text-slate-400 text-sm mb-2">Seniority Level</p>
                  <p className="text-white font-semibold text-lg">{enrichment.inferred_seniority}</p>
                </div>
              )}
              {enrichment.company_size && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <p className="text-slate-400 text-sm mb-2">Company Size</p>
                  <p className="text-white font-semibold text-lg">{enrichment.company_size}</p>
                </div>
              )}
            </div>

            {/* Company Overview */}
            {enrichment.company_overview && (
              <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-4">Company Overview</h2>
                <p className="text-slate-300 leading-relaxed">{enrichment.company_overview}</p>
              </div>
            )}

            {/* Talking Points */}
            {enrichment.talking_points && Array.isArray(enrichment.talking_points) && enrichment.talking_points.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-4">Talking Points</h2>
                <ul className="space-y-3">
                  {enrichment.talking_points.map((point: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-blue-400 font-bold mt-1">•</span>
                      <span className="text-slate-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Approach */}
            {enrichment.recommended_approach && (
              <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-4">Recommended Approach</h2>
                <p className="text-slate-300 leading-relaxed">{enrichment.recommended_approach}</p>
              </div>
            )}

            {/* Recent News */}
            {enrichment.recent_news && (
              <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-4">Recent News</h2>
                <p className="text-slate-300">{enrichment.recent_news}</p>
              </div>
            )}

            {/* Raw JSON */}
            <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
              <h2 className="text-2xl font-bold text-white mb-4">Raw Enrichment Data</h2>
              <pre className="bg-slate-900 p-4 rounded overflow-auto max-h-96 text-sm text-slate-300">
                {JSON.stringify(enrichment, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {contact.enrichment_status !== 'completed' && (
          <div className="bg-yellow-900 text-yellow-200 p-6 rounded-lg border border-yellow-700">
            <p className="text-lg font-semibold">Enrichment Status: {contact.enrichment_status || 'pending'}</p>
            <p className="text-sm mt-2">Run enrichment on this contact to see detailed intelligence.</p>
          </div>
        )}
      </div>
    </div>
  );
}
