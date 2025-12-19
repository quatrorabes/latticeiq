import { supabase } from '../lib/supabase';
import type { Contact, ContactFormData } from '../types/contact';

export const contactsService = {
  async getContacts(): Promise<Contact[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return data || [];
  },

  async deleteContact(id: number): Promise<void> {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
