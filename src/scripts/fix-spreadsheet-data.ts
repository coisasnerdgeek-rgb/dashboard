
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function fixSpreadsheetData() {
    console.log('Fixing corrupted spreadsheet_data...');

    // Fetch corrupt candidates (client-side filter to be safe)
    const { data: rows, error } = await supabase
        .from('spreadsheet_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3000); // Increased limit to catch more

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    const toDelete: string[] = [];

    rows.forEach(row => {
        const d = row.row_data;
        if (!d) return;

        const id = d['Identificador do pedido e-commerce'] || d['ID Pedido'] || d['id'];
        const client = d['Cliente'] || d['cliente'] || d['Nome'];

        // CRITERIA: Literal 'undefined' in ID or Client, or empty ID
        const isUndefined = String(id).includes('undefined') || String(client).includes('undefined');
        const isEmptyId = !id || id === '-' || id === '';

        if (isUndefined || isEmptyId) {
            toDelete.push(row.id);
        }
    });

    console.log(`Found ${toDelete.length} corrupted rows to delete.`);

    if (toDelete.length > 0) {
        // Delete in batches of 100
        const batchSize = 100;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            const { error: delError } = await supabase
                .from('spreadsheet_data')
                .delete()
                .in('id', batch);

            if (delError) console.error('Error checking delete:', delError);
            else console.log(`Deleted batch ${i / batchSize + 1} (${batch.length} rows)`);
        }
    }
    console.log('Done.');
}

fixSpreadsheetData();
