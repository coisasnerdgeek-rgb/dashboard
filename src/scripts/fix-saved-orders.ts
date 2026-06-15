
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function fixSavedOrders() {
    console.log('Checking saved_orders for corruption...');

    // saved_orders structure: id, cnpj, sizes, store, colors, totals, product, quantities, archivedDate, etc.
    // The "id" itself might be corrupted or valid-looking but content bad.
    // But if the source ID was "undefined", it might have propagated to `_sourceRowIds`.

    // We check `_sourceRowIds` inside the `data` column if possible?
    // Actually, let's just look for "undefined" in the whole row representation or ID.

    const { data: rows, error } = await supabase
        .from('saved_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);

    if (error) {
        console.error('Error:', error);
        return;
    }

    const toDelete: string[] = [];
    rows.forEach(row => {
        // Check if ID contains 'undefined'
        if (row.id && row.id.includes('undefined')) {
            toDelete.push(row.id);
        }
    });

    console.log(`Found ${toDelete.length} corrupted saved_orders.`);

    if (toDelete.length > 0) {
        const { error: delError } = await supabase
            .from('saved_orders')
            .delete()
            .in('id', toDelete);

        if (delError) console.error('Delete error:', delError);
        else console.log('Deleted corrupted saved_orders.');
    }
}

fixSavedOrders();
