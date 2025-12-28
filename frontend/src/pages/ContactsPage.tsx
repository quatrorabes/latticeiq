import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import ContactDetailModal from '../components/ContactDetailModal';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  enrichment_status: string;
  enrichment_data: any;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .limit(100);

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
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) {
      alert('Error deleting contact: ' + error.message);
    } else {
      loadContacts();
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Contacts</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ccc' }}>
            <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Email</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Company</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Status</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>
                {contact.first_name} {contact.last_name}
              </td>
              <td style={{ padding: '10px' }}>{contact.email}</td>
              <td style={{ padding: '10px' }}>{contact.company || '-'}</td>
              <td style={{ padding: '10px' }}>{contact.enrichment_status || 'pending'}</td>
              <td style={{ padding: '10px' }}>
                <button
                  onClick={() => openModal(contact)}
                  style={{
                    padding: '5px 10px',
                    marginRight: '5px',
                    background: '#0066cc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  View
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
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
