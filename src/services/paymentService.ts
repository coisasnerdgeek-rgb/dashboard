import { supabase } from './supabaseClient';
import { PaymentItem } from '../Dashboard/types';

export const getPendingPayments = async (): Promise<PaymentItem[]> => {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('is_archived', false);

    if (error) throw error;

    return data?.map((item: any) => ({
        ...item.data_json,
        id: item.id
    })) || [];
};

export const getArchivedPayments = async (): Promise<PaymentItem[]> => {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('is_archived', true);

    if (error) throw error;

    return data?.map((item: any) => ({
        ...item.data_json,
        id: item.id
    })) || [];
};

export const savePayment = async (payment: PaymentItem, isArchived: boolean = false) => {
    const { error } = await supabase
        .from('payments')
        .upsert({
            id: payment.id,
            data_json: payment,
            is_archived: isArchived
        });

    if (error) throw error;
};

export const deletePayment = async (id: string) => {
    const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

    if (error) throw error;
};
