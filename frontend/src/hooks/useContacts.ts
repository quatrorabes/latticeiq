// frontend/src/hooks/useContacts.ts
import { useState, useEffect, useCallback } from "react";
import { getContacts, deleteContact } from "../services/contactsService";
import type { Contact } from "../types/contact";

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContacts();
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const removeContact = async (id: string) => {
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contact");
    }
  };

  const removeContacts = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => deleteContact(id)));
      setContacts((prev) => prev.filter((c) => !ids.includes(c.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contacts");
    }
  };

  return { contacts, loading, error, loadContacts, removeContact, removeContacts };
}

export default useContacts;
