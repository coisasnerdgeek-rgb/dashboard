import { supabase } from './supabaseClient';
import { Contact } from '../Dashboard/types';

export const getContacts = async (): Promise<Contact[]> => {
    const { data, error } = await supabase
        .from('contacts')
        .select('*');

    if (error) {
        console.error('Error fetching contacts:', error);
        throw error;
    }

    return (data || []).map((item: any) => ({
        id: item.id,
        store: item.store,
        name: item.name,
        whatsapp: item.phone, // Map DB 'phone' to frontend 'whatsapp'
        email: item.email
    }));
};

export const saveContact = async (contact: Contact): Promise<Contact> => {
    const dbContact = {
        id: contact.id,
        store: contact.store,
        name: contact.name,
        phone: contact.whatsapp, // Map frontend 'whatsapp' to DB 'phone'
        email: contact.email
    };

    const { data, error } = await supabase
        .from('contacts')
        .upsert(dbContact)
        .select()
        .single();

    if (error) {
        console.error('Error saving contact:', error);
        throw error;
    }

    return {
        id: data.id,
        store: data.store,
        name: data.name,
        whatsapp: data.phone,
        email: data.email
    };
};

export const deleteContact = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting contact:', error);
        throw error;
    }
};

export const subscribeToContacts = (onUpdate: () => void) => {
    // Use unique channel name to avoid React StrictMode double-mount conflict
    const channel = supabase
        .channel(`contacts_changes_${Date.now()}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'contacts'
            },
            (payload) => {
                console.log('Realtime update received:', payload);
                onUpdate();
            }
        )
        .subscribe();

    // Return object with unsubscribe that fully removes the channel
    return {
        unsubscribe: () => {
            supabase.removeChannel(channel);
        }
    };
};
