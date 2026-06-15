
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function fixSpreadsheetDataSafe() {
    console.log('Fixing corrupted spreadsheet_data (SAFE MODE)...');

    let totalDeleted = 0;

    // Check top 2000 rows, delete in batches of 20
    for (let round = 1; round <= 200; round++) {
        const { data: rows, error } = await supabase
            .from('spreadsheet_data')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100); // Fetch 100

        if (error) {
            console.error('Error fetching:', error);
            break;
        }

        if (!rows || rows.length === 0) break;

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
            console.log(`Round ${round}: Clean batch. Stopping.`);
            break;
        }

        console.log(`Round ${round}: Found ${toDelete.length} bad rows.`);

        // Delete in small sub-batches
        const DELETE_BATCH = 20;
        for (let i = 0; i < toDelete.length; i += DELETE_BATCH) {
            const chunk = toDelete.slice(i, i + DELETE_BATCH);
            const { error: delError } = await supabase
                .from('spreadsheet_data')
                .delete()
                .in('id', chunk);

            if (delError) console.error('Delete error:', delError);
            else totalDeleted += chunk.length;
        }

        console.log(`Deleted so far: ${totalDeleted}`);
        if (totalDeleted > 5000) {
            console.log('Safety limit reached.');
            break;
        }
    }

    console.log(`Done. Total deleted: ${totalDeleted}`);
}

fixSpreadsheetDataSafe();
