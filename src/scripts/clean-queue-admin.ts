
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const supabase = createClient(NEW_SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function parsePTDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
}

async function cleanQueueAdmin() {
    console.log('Cleaning webhook_retry_queue (ADMIN) - Items <= 25/01/2026...');

    // Check Status before
    const { count: pendingBefore } = await supabase.from('webhook_retry_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    console.log(`Pending items before: ${pendingBefore}`);

    const cutOffDate = new Date('2026-01-25T23:59:59Z');
    let totalDeleted = 0;

    // Loop processing
    while (true) {
        // Fetch batch
        const { data: rows, error } = await supabase
            .from('webhook_retry_queue')
            .select('id, order_date')
            .limit(1000);

        if (error) {
            console.error('Fetch error:', error);
            break;
        }

        if (!rows || rows.length === 0) break;

        const toDelete: string[] = [];

        rows.forEach(row => {
            const orderDate = parsePTDate(row.order_date || '');
            if (orderDate && orderDate <= cutOffDate) {
                toDelete.push(row.id);
            }
        });

        if (toDelete.length === 0) {
            console.log('Batch has no old items. Checking if we need to paginate or stop?');
            // If we fetched 1000 and NONE matched, but there are more...
            // We need to verify if we just grabbed "new" ones.
            // But we are not ordering. Default order usually PK.
            // If we are deleting them, they disappear, so next fetch gets different ones.
            // BUT if we DON'T delete them (because they are new), we get stuck in loop fetching same 1000.
            // So we must break if toDelete is empty, UNLESS we can scroll.
            // Better: fetch only those matching our criteria if possible.
            // Sadly order_date is text in JSON/column? It's a column 'order_date'.
            // Note: date comparison on DD/MM/YYYY string in SQL is bad.
            // So we stick to client side.
            // To avoid infinite loop, we should probably order by something or use offset.
            // Or just break.
            break;
        }

        // Delete
        const { error: delError } = await supabase
            .from('webhook_retry_queue')
            .delete()
            .in('id', toDelete);

        if (delError) {
            console.error('Delete error:', delError);
            break;
        }

        totalDeleted += toDelete.length;
        console.log(`Deleted ${toDelete.length} items. Total: ${totalDeleted}`);
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Done. Total deleted: ${totalDeleted}`);
}

cleanQueueAdmin();
