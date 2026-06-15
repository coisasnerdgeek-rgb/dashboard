import { supabase } from './supabaseClient';

/**
 * Service for managing exclusions specifically for the Montar Pedido view.
 * These exclusions are saved in the database but do NOT affect other views like Estampas.
 */

export async function getMontagemExclusions(): Promise<Set<string>> {
    try {
        const { data, error } = await supabase
            .from('montagem_exclusions')
            .select('order_id');

        if (error) {
            console.error('Error fetching montagem exclusions:', error);
            return new Set();
        }

        return new Set(data?.map(d => d.order_id) || []);
    } catch (error) {
        console.error('Error in getMontagemExclusions:', error);
        return new Set();
    }
}

export async function addMontagemExclusion(orderId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('montagem_exclusions')
            .insert({ order_id: orderId });

        if (error) {
            if (error.code === '23505') return true; // Already exists
            console.error('Error adding montagem exclusion:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in addMontagemExclusion:', error);
        return false;
    }
}

export async function removeMontagemExclusion(orderId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('montagem_exclusions')
            .delete()
            .eq('order_id', orderId);

        if (error) {
            console.error('Error removing montagem exclusion:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in removeMontagemExclusion:', error);
        return false;
    }
}

export async function clearMontagemExclusions(): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('montagem_exclusions')
            .delete()
            .neq('order_id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
            console.error('Error clearing montagem exclusions:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in clearMontagemExclusions:', error);
        return false;
    }
}
