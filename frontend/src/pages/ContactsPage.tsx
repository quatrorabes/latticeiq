// frontend/src/pages/ContactsPage.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import AddContactModal from '../components/AddContactModal';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  title: string | null;
  phone: string | null;
  linkedin_url: string | null;
  enrichment_status: string | null;
  mdcp_score: number | null;
  bant_score: number | null;
  spice_score: number | null;
  created_at: string;
}

type ImportSource = 'csv' | 'hubspot' | 'salesforce' | 'pipedrive';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<ImportSource>('hubspot');

  const apiUrl = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContacts(data as Contact[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const getAuthToken = async () => {
    const session = await supabase.auth.getSession();
    return session?.data?.session?.access_token;
  };

  const handleCsvFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const resp = await fetch(`${apiUrl}/api/v3/crm/import/csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`CSV import failed: ${resp.status} ${text}`);
      }

      const json = await resp.json().catch(() => null);
      const count = json?.imported_count ?? json?.count ?? '';
      setImportSuccess(
        count ? `Imported ${count} contacts from CSV.` : 'CSV import completed.'
      );
      await fetchContacts();
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Failed to import CSV contacts'
      );
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const triggerSourceImport = async (source: ImportSource) => {
    if (source === 'csv') return;
    
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    
    try {
      const token = await getAuthToken();
      const endpoint = `/api/v3/crm/import/${source}`;
      
      const resp = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (!resp.ok) {
        const json = await resp.json().catch(() => null);
        
        // Check if it's a missing API key error
        if (resp.status === 422 && json?.detail?.[0]?.loc?.includes('api_key')) {
          throw new Error(`Please configure your ${source} API key in Settings first.`);
        }
        
        throw new Error(`${source} import failed: ${resp.status} ${JSON.stringify(json?.detail || json)}`);
      }
  
      const json = await resp.json().catch(() => null);
      const count = json?.imported_count ?? json?.count ?? '';
      const label = source === 'hubspot' ? 'HubSpot' : source === 'salesforce' ? 'Salesforce' : 'Pipedrive';
  
      setImportSuccess(count ? `Imported ${count} contacts from ${label}.` : `${label} import completed.`);
      await fetchContacts();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import contacts');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-gray-400 text-sm">
            Import from CSV, HubSpot, Salesforce, or Pipedrive, then score with MDCP/BANT/SPICE.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              className="form-control !w-auto !py-2 !px-3 text-sm"
              value={selectedSource}
              onChange={(e) =>
                setSelectedSource(e.target.value as ImportSource)
              }
              disabled={importing}
            >
              <option value="hubspot">HubSpot</option>
              <option value="salesforce">Salesforce</option>
              <option value="pipedrive">Pipedrive</option>
              <option value="csv">CSV</option>
            </select>
            <button
              onClick={onImportClick}
              disabled={importing}
              className="btn btn-outline text-sm"
            >
              {importing ? 'Importing…' : 'Import Contacts'}
            </button>
            {/* hidden CSV input */}
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvFileChange}
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary text-sm"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* Import alerts */}
      {importError && (
        <div className="bg-red-900/30 border border-red-500 text-red-200 text-sm rounded-lg px-4 py-3">
          {importError}
        </div>
      )}
      {importSuccess && (
        <div className="bg-emerald-900/30 border border-emerald-500 text-emerald-200 text-sm rounded-lg px-4 py-3">
          {importSuccess}
        </div>
      )}

      {/* Table / empty state */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner spinner-lg" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="card">
          <div className="card-body text-center">
            <h2 className="text-xl font-semibold mb-2">
              No contacts yet
            </h2>
            <p className="text-gray-400 mb-4">
              Import from your CRM or upload a CSV to get started.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <button
                className="btn btn-outline text-sm"
                onClick={() => {
                  setSelectedSource('csv');
                  const input = document.getElementById(
                    'csv-file-input'
                  ) as HTMLInputElement | null;
                  input?.click();
                }}
              >
                Upload CSV
              </button>
              <button
                className="btn btn-outline text-sm"
                onClick={() => void triggerSourceImport('hubspot')}
              >
                Import from HubSpot
              </button>
              <button
                className="btn btn-outline text-sm"
                onClick={() => void triggerSourceImport('salesforce')}
              >
                Import from Salesforce
              </button>
              <button
                className="btn btn-outline text-sm"
                onClick={() => void triggerSourceImport('pipedrive')}
              >
                Import from Pipedrive
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>MDCP</th>
                  <th>BANT</th>
                  <th>SPICE</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.first_name} {c.last_name}
                    </td>
                    <td>{c.company}</td>
                    <td>{c.title}</td>
                    <td>{c.email}</td>
                    <td>{c.mdcp_score ?? '-'}</td>
                    <td>{c.bant_score ?? '-'}</td>
                    <td>{c.spice_score ?? '-'}</td>
                    <td>{c.enrichment_status ?? 'pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onAdd={fetchContacts}
        />
      )}
    </div>
  );
}
