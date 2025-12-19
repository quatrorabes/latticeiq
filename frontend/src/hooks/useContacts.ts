// frontend/src/hooks/useContacts.ts
import { useState, useEffect, useCallback } from 'react';
import type { Contact } from '../types/contact';
import { getContacts, deleteContact, deleteContacts } from '../services/contactsService';

interface UseContactsReturn {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  removeContact: (id: number) => Promise<void>;
  removeContacts: (ids: number[]) => Promise<void>;
}

export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getContacts();
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const removeContact = useCallback(async (id: number) => {
    await deleteContact(id);
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);

  const removeContacts = useCallback(async (ids: number[]) => {
    await deleteContacts(ids);
    setContacts(prev => prev.filter(c => !ids.includes(c.id)));
  }, []);

  return {
    contacts,
    loading,
    error,
    refresh: loadContacts,
    removeContact,
    removeContacts,
  };
}

export default useContacts;
