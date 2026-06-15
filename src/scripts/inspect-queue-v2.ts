import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://geabvcqcymaqsqxxfqyw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    console.log('--- Inspecting Webhook Retry Queue ---');

    // Count by status
    const { data: statusCounts, error: statusError } = await supabase.rpc('count_queue_status');
    // If RPC doesn't exist, we do manual group by simulation or just multiple queries

    // Group by query is not directly supported in simple select without RPC usually, but let's try multiple counts
    const statuses = ['pending', 'processing', 'completed', 'failed', 'error'];
    for (const status of statuses) {
        const { count, error } = await supabase
            .from('webhook_retry_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', status);

        if (error) console.error(`Error counting ${status}:`, error.message);
        else console.log(`Status '${status}': ${count}`);
    }

    // Check oldest and newest pending
    const { data: oldestPending } = await supabase
        .from('webhook_retry_queue')
        .select('order_id, order_date, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

    // Check recent failed items
    const { data: failedItems } = await supabase
        .from('webhook_retry_queue')
        .select('order_id, last_error, created_at, retry_count')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(5);

    if (failedItems?.length) {
        console.log('\n--- Recent Failed Items ---');
        failedItems.forEach(f => console.log(`ID: ${f.order_id}, Error: ${f.last_error}, Created: ${f.created_at}`));
    }

    // Check items older than 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { count: oldItemsCount, error: oldError } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', sixtyDaysAgo.toISOString());

    console.log(`Items older than 60 days: ${oldItemsCount} (Error: ${oldError?.message || 'None'})`);

    console.log('\n--- Inspecting Spreadsheet Data ---');
    const { data: lastImport } = await supabase
        .from('spreadsheet_data')
        .select('id, import_date, row_data')
        .order('import_date', { ascending: false })
        .limit(1);

    if (lastImport?.length) {
        console.log('Last Import:', lastImport[0].import_date);
        console.log('Last Order Details:', {
            id: lastImport[0].id,
            tiny_id: lastImport[0].row_data['ID Tiny'],
            date: lastImport[0].row_data['Data']
        });
    }
}

inspect().catch(console.error);
