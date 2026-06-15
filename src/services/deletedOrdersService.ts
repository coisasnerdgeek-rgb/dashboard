import { supabase } from './supabaseClient';

/**
 * Service for managing deleted orders in the database
 */

export async function getDeletedOrderIds(): Promise<Set<string>> {
    try {
        const { data, error } = await supabase
            .from('deleted_orders')
            .select('order_id');

        if (error) {
            console.error('Error fetching deleted orders:', error);
            return new Set();
        }

        return new Set(data?.map(d => d.order_id) || []);
    } catch (error) {
        console.error('Error in getDeletedOrderIds:', error);
        return new Set();
    }
}

export async function addDeletedOrder(orderId: string, tinyId?: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('deleted_orders')
            .insert({
                order_id: orderId,
                tiny_id: tinyId
            });

        if (error) {
            // Ignore duplicate key errors (already deleted)
            if (error.code === '23505') {
                return true;
            }
            console.error('Error adding deleted order:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in addDeletedOrder:', error);
        return false;
    }
}

export async function removeDeletedOrder(orderId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('deleted_orders')
            .delete()
            .eq('order_id', orderId);

        if (error) {
            console.error('Error removing deleted order:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in removeDeletedOrder:', error);
        return false;
    }
}

export async function bulkAddDeletedOrders(orderIds: string[]): Promise<boolean> {
    try {
        // Deduplicate IDs to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time" error
        const uniqueIds = Array.from(new Set(orderIds));

        const records = uniqueIds.map(id => ({
            order_id: id
        }));

        const { error } = await supabase
            .from('deleted_orders')
            .upsert(records, { onConflict: 'order_id' });

        if (error) {
            console.error('Error bulk adding deleted orders:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in bulkAddDeletedOrders:', error);
        return false;
    }
}

export async function bulkRemoveDeletedOrders(orderIds: string[]): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('deleted_orders')
            .delete()
            .in('order_id', orderIds);

        if (error) {
            console.error('Error bulk removing deleted orders:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in bulkRemoveDeletedOrders:', error);
        return false;
    }
}
