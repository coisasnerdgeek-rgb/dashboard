
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function checkCorruptedJSON() {
    console.log('Checking spreadsheet_data (JSONB)...');

    // 1. Fetch all rows and filter in memory (safer for complex JSON checks if dataset < 10k)
    // Or try filtering via API if possible.

    // Let's fetch the last 1000 rows, assuming corruption is recent.
    const { data: rows, error } = await supabase
        .from('spreadsheet_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    let undefinedCount = 0;
    let corruptedVitorCount = 0;
    const toDelete: string[] = [];

    rows.forEach(row => {
        const d = row.row_data;
        if (!d) return;

        // Check for literal "undefined" in ID field
        // Note: Field name depends on CSV header mapping. Usually "Identificador do pedido e-commerce"
        const id = d['Identificador do pedido e-commerce'] || d['ID Pedido'] || d['id'];
        const client = d['Cliente'] || d['cliente'] || d['Nome'];

        const isUndefined = String(id).includes('undefined') || String(client).includes('undefined');
        const isVitor = String(client).toLowerCase().includes('vitor bruel');

        // Check for the "Vitor Bruel" bad rows seen in screenshot (missing ID/SKU usually implies empty or "-")
        // Screenshot showed ID "-" and SKU "-"
        const isEmptyId = !id || id === '-' || id === '';

        if (isUndefined) {
            undefinedCount++;
            toDelete.push(row.id);
        }

        if (isVitor && isEmptyId) {
            corruptedVitorCount++;
            toDelete.push(row.id);
        }
    });

    console.log(`Scanned ${rows.length} recent rows.`);
    console.log(`Found ${undefinedCount} rows with 'undefined' values.`);
    console.log(`Found ${corruptedVitorCount} corrupted 'Vitor Bruel' rows.`);
    console.log(`Total candidates for deletion: ${toDelete.length}`);

    if (toDelete.length > 0) {
        console.log('Sample IDs to delete:', toDelete.slice(0, 5));
    }
}

checkCorruptedJSON();
