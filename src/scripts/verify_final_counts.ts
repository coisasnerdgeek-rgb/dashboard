import { createClient } from '@supabase/supabase-js';

// NEW DB Credentials
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function verify() {
    console.log('--- FINAL VERIFICATION ---');

    // 1. Saved Orders
    const { count: ordersCount, error: ordersError } = await newSupabase
        .from('saved_orders')
        .select('*', { count: 'exact', head: true });

    console.log(`Saved Orders Count: ${ordersCount} (Error: ${ordersError?.message || 'none'})`);

    // 2. Spreadsheet Data
    const { count: sheetCount, error: sheetError } = await newSupabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true });

    console.log(`Spreadsheet files Count: ${sheetCount} (Error: ${sheetError?.message || 'none'})`);

    // 3. Sample Data Integrity
    const { data: sampleOrder } = await newSupabase.from('saved_orders').select('id, data_json').limit(1);
    if (sampleOrder && sampleOrder.length > 0) {
        console.log('Sample Order ID:', sampleOrder[0].id);
        const hasData = sampleOrder[0].data_json && Object.keys(sampleOrder[0].data_json).length > 0;
        console.log('Sample Order Has JSON:', hasData);
    } else {
        console.log('WARNING: No Saved Orders found for sample.');
    }
}

verify();
