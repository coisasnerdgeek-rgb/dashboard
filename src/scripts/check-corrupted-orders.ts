
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function checkCorrupted() {
    console.log('Checking for corrupted orders in saved_orders...');

    // 1. Check for 'undefined' in order_id
    const { data: undefinedIds, error: err1 } = await supabase
        .from('saved_orders')
        .select('id, order_id, customer, date')
        .ilike('order_id', '%undefined%');

    if (err1) console.error('Error checking undefined IDs:', err1);
    else console.log(`Found ${undefinedIds?.length} orders with "undefined" in ID.`);
    if (undefinedIds?.length) console.log('Sample:', undefinedIds.slice(0, 3));

    // 2. Check for missing vital fields (like customer name missing but order exists)
    // The screenshot showed 'Vitor Bruel' multiple times but missing ID.
    // Maybe order_id is null? (It's usually PK or non-null, but let's check empty strings)
    const { data: emptyIds, error: err2 } = await supabase
        .from('saved_orders')
        .select('id, order_id, customer, date')
        .eq('order_id', '');

    if (err2) console.error('Error checking empty IDs:', err2);
    else console.log(`Found ${emptyIds?.length} orders with empty string ID.`);

    // 3. Check for specific customer "Vitor Bruel" to see what those rows look like
    const { data: vitor, error: err3 } = await supabase
        .from('saved_orders')
        .select('*')
        .ilike('customer', '%Vitor Bruel%')
        .order('created_at', { ascending: false })
        .limit(5);

    if (err3) console.error('Error checking Vitor Bruel:', err3);
    else {
        console.log(`Checking rows for "Vitor Bruel":`);
        vitor?.forEach(row => {
            console.log(`ID: ${row.id}, OrderID: ${row.order_id}, SKU: ${row.sku_list}, Status: ${row.status}`);
        });
    }

    // 4. Check for rows created TODAY (since user mentioned "script do dia de hoje")
    const today = new Date().toISOString().split('T')[0];
    const { count: countToday } = await supabase
        .from('saved_orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);

    console.log(`Total orders created today (${today}): ${countToday}`);
}

checkCorrupted();
