import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import ContactDetailModal from '../components/ContactDetailModal';

interface Contact {
  [key: string]: any;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enriched' | 'pending' | 'failed'>('all');

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .limit(500);

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
    } finally {
      setLoading(false);
    }
  }

  function openModal(contact: Contact) {
    setSelectedContact(contact);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setSelectedContact(null);
  }

  async function handleEnrichComplete() {
    await loadContacts();
  }

  async function deleteContact(id: string) {
    if (!window.confirm('Are you sure?')) return;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      loadContacts();
    }
  }

  // Filter contacts by search AND status
  let filteredContacts = contacts.filter((c) =>
    `${c.first_name} ${c.last_name} ${c.email} ${c.company}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (statusFilter !== 'all') {
    filteredContacts = filteredContacts.filter((c) => c.enrichment_status === statusFilter);
  }

  // Get all unique field names
  const allFields = Array.from(
    new Set(contacts.flatMap((c) => Object.keys(c)))
  ).sort();

  // Core fields to always show
  const coreFields = ['first_name', 'last_name', 'email', 'company', 'title', 'phone', 'enrichment_status', 'apex_score'];
  const otherFields = allFields.filter((f) => !coreFields.includes(f));

  // Status counts
  const statusCounts = {
    enriched: contacts.filter((c) => c.enrichment_status === 'enriched').length,
    pending: contacts.filter((c) => c.enrichment_status === 'pending' || !c.enrichment_status).length,
    failed: contacts.filter((c) => c.enrichment_status === 'failed').length,
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading contacts...</div>;

  return (
    <div style={{ padding: '20px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: '0' }}>👥 Contacts ({filteredContacts.length})</h1>
        <input
          type="text"
          placeholder="🔍 Search by name, email, company..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px',
            border: '1px solid #444',
            borderRadius: '4px',
            background: '#1a1a1a',
            color: '#fff',
            width: '300px',
          }}
        />
      </div>

      {/* STATUS FILTERS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setStatusFilter('all')}
          style={{
            padding: '8px 16px',
            background: statusFilter === 'all' ? '#0066cc' : '#444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: statusFilter === 'all' ? 'bold' : 'normal',
          }}
        >
          All ({contacts.length})
        </button>
        <button
          onClick={() => setStatusFilter('enriched')}
          style={{
            padding: '8px 16px',
            background: statusFilter === 'enriched' ? '#00cc00' : '#444',
            color: statusFilter === 'enriched' ? '#000' : 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: statusFilter === 'enriched' ? 'bold' : 'normal',
          }}
        >
          ✅ Enriched ({statusCounts.enriched})
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          style={{
            padding: '8px 16px',
            background: statusFilter === 'pending' ? '#ffcc00' : '#444',
            color: statusFilter === 'pending' ? '#000' : 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: statusFilter === 'pending' ? 'bold' : 'normal',
          }}
        >
          ⏳ Pending ({statusCounts.pending})
        </button>
        <button
          onClick={() => setStatusFilter('failed')}
          style={{
            padding: '8px 16px',
            background: statusFilter === 'failed' ? '#ff6666' : '#444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: statusFilter === 'failed' ? 'bold' : 'normal',
          }}
        >
          ❌ Failed ({statusCounts.failed})
        </button>
      </div>

      {/* SCROLLABLE TABLE */}
      <div style={{ overflowX: 'auto', border: '1px solid #444', borderRadius: '4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
          <thead>
            <tr style={{ background: '#0a0a0a', borderBottom: '2px solid #0066cc' }}>
              {coreFields.map((field) => (
                <th
                  key={field}
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#0066cc',
                    minWidth: field === 'enrichment_status' ? '100px' : field === 'apex_score' ? '80px' : '120px',
                    borderRight: '1px solid #333',
                  }}
                >
                  {field === 'enrichment_status' ? '📊 STATUS' : field === 'apex_score' ? '⭐ APEX' : field.replace(/_/g, ' ').toUpperCase()}
                </th>
              ))}

              {/* Additional Fields */}
              {otherFields.map((field) => (
                <th
                  key={field}
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#666',
                    fontSize: '11px',
                    minWidth: '100px',
                    borderRight: '1px solid #333',
                  }}
                >
                  {field.replace(/_/g, ' ').toUpperCase()}
                </th>
              ))}

              <th
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontWeight: 'bold',
                  color: '#0066cc',
                  minWidth: '150px',
                }}
              >
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((contact) => (
              <tr key={contact.id} style={{ borderBottom: '1px solid #333', background: '#1a1a1a' }}>
                {coreFields.map((field) => (
                  <td
                    key={field}
                    style={{
                      padding: '10px',
                      fontSize: '12px',
                      borderRight: '1px solid #333',
                      maxWidth: field === 'enrichment_status' ? '100px' : field === 'apex_score' ? '80px' : '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {field === 'enrichment_status' ? (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          display: 'inline-block',
                          background:
                            contact[field] === 'enriched'
                              ? '#003300'
                              : contact[field] === 'failed'
                              ? '#330000'
                              : '#663300',
                          color:
                            contact[field] === 'enriched'
                              ? '#00ff00'
                              : contact[field] === 'failed'
                              ? '#ff0000'
                              : '#ffcc00',
                        }}
                      >
                        {contact[field] || 'pending'}
                      </span>
                    ) : field === 'apex_score' ? (
                      <span
                        style={{
                          fontWeight: 'bold',
                          color: contact[field] ? '#00ff00' : '#666',
                          fontSize: '14px',
                        }}
                      >
                        {contact[field] ? Math.round(contact[field]) : '-'}
                      </span>
                    ) : (
                      contact[field] || '-'
                    )}
                  </td>
                ))}

                {otherFields.map((field) => (
                  <td
                    key={field}
                    style={{
                      padding: '10px',
                      fontSize: '10px',
                      color: '#666',
                      borderRight: '1px solid #333',
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={contact[field] ? String(contact[field]).substring(0, 100) : '-'}
                  >
                    {contact[field]
                      ? typeof contact[field] === 'object'
                        ? '(object)'
                        : String(contact[field]).substring(0, 50)
                      : '-'}
                  </td>
                ))}

                <td style={{ padding: '10px', display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => openModal(contact)}
                    style={{
                      padding: '5px 10px',
                      background: '#0066cc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    👁️ View
                  </button>
                  <button
                    onClick={() => deleteContact(contact.id)}
                    style={{
                      padding: '5px 10px',
                      background: '#cc0000',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredContacts.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          <p>No contacts found. Try importing from CRM or CSV.</p>
        </div>
      )}

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={isModalOpen}
          onClose={closeModal}
          onEnrichComplete={handleEnrichComplete}
        />
      )}
    </div>
  );
}