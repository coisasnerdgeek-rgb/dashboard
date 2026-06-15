
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function fixSpreadsheetDataAggressive() {
    console.log('Fixing corrupted spreadsheet_data (AGGRESSIVE MODE)...');

    let totalDeleted = 0;

    // Loop until we find no more bad rows or hit a safety limit (e.g., 50k)
    for (let round = 1; round <= 50; round++) {
        const { data: rows, error } = await supabase
            .from('spreadsheet_data')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000); // Process 1000 at a time

        if (error) {
            console.error('Error fetching:', error);
            break;
        }

        if (!rows || rows.length === 0) {
            console.log('No more rows to check.');
            break;
        }

        const toDelete: string[] = [];

        rows.forEach(row => {
            const d = row.row_data;
            if (!d) return;

            const id = d['Identificador do pedido e-commerce'] || d['ID Pedido'] || d['id'];
            const client = d['Cliente'] || d['cliente'] || d['Nome'];

            const isUndefined = String(id).includes('undefined') || String(client).includes('undefined');
            const isEmptyId = !id || id === '-' || id === '';

            if (isUndefined || isEmptyId) {
                toDelete.push(row.id);
            }
        });

        if (toDelete.length === 0) {
            console.log(`Round ${round}: No corrupt rows found in this batch. Stopping.`);
            // Note: If we scan the top 1000 and find none, and we're ordering by created_at desc, 
            // it implies the recent ones are clean. Good.
            break;
        }

        console.log(`Round ${round}: Found ${toDelete.length} bad rows.`);

        // Delete
        const { error: delError } = await supabase
            .from('spreadsheet_data')
            .delete()
            .in('id', toDelete);

        if (delError) {
            console.error('Delete error:', delError);
            break;
        }

        totalDeleted += toDelete.length;
        console.log(`Deleted ${toDelete.length} rows. Total: ${totalDeleted}`);

        // Small delay to be nice to DB (optional, but good practice)
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Done. Total deleted: ${totalDeleted}`);
}

fixSpreadsheetDataAggressive();
