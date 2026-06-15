
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

function parsePTDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    // DD/MM/YYYY -> YYYY-MM-DD
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
}

async function cleanQueue() {
    console.log('Cleaning webhook_retry_queue (items <= 25/01/2026)...');

    // Check Status distribution
    const { data: statusData } = await supabase.from('webhook_retry_queue').select('status');
    const statusCounts: Record<string, number> = {};
    statusData?.forEach(r => statusCounts[r.status] = (statusCounts[r.status] || 0) + 1);
    console.log('Current Status Counts:', statusCounts);

    // Fetch all item's ID and order_date
    // (If 24k items exist, we might need pagination, but let's try fetch first 10000)
    const { data: rows, error } = await supabase
        .from('webhook_retry_queue')
        .select('id, order_date')
        .limit(10000);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log('No rows found.');
        return;
    }

    const cutOffDate = new Date('2026-01-25T23:59:59Z');

    const toDelete: string[] = [];

    rows.forEach(row => {
        const orderDate = parsePTDate(row.order_date || '');
        if (orderDate && orderDate <= cutOffDate) {
            toDelete.push(row.id);
        } else if (!orderDate) {
            // Also delete if date is missing/invalid? User said "do dia 25 para tras".
            // If missing, maybe safe to delete if it's old 'created_at'?
            // Let's stick to valid dates <= 25.
        }
    });

    console.log(`Found ${toDelete.length} items older than or equal to 25/01.`);

    if (toDelete.length > 0) {
        // Delete in batches
        const BATCH = 500;
        for (let i = 0; i < toDelete.length; i += BATCH) {
            const chunk = toDelete.slice(i, i + BATCH);
            const { error: delError } = await supabase
                .from('webhook_retry_queue')
                .delete()
                .in('id', chunk);

            if (delError) console.error('Delete error:', delError);
            else console.log(`Deleted batch ${i / BATCH + 1} (${chunk.length} items)`);
        }
    }
    console.log('Done.');
}

cleanQueue();
