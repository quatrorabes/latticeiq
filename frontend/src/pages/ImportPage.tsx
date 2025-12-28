import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';


export default function App() {
  const [currentPage, setCurrentPage] = useState<'contacts' | 'import'>('contacts');

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* NAV */}
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #444', padding: '15px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setCurrentPage('contacts')}
            style={{
              padding: '8px 16px',
              background: currentPage === 'contacts' ? '#0066cc' : '#444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            📋 Contacts
          </button>
          <button
            onClick={() => setCurrentPage('import')}
            style={{
              padding: '8px 16px',
              background: currentPage === 'import' ? '#0066cc' : '#444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            📤 Import
          </button>
        </div>
      </div>

      {/* PAGES */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {currentPage === 'contacts' && <ContactsPage />}
        {currentPage === 'import' && <ImportPage />}
      </div>
    </div>
  );
}
