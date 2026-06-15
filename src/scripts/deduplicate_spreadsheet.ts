import { createClient } from '@supabase/supabase-js';

// NEW DB Credentials
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function deduplicate() {
    console.log('--- Deduplicating spreadsheet_data ---');

    // Fetch all rows
    let allSheets: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        // Fetch ID, Import Date, and Content
        const { data, error } = await newSupabase
            .from('spreadsheet_data')
            .select('id, import_date, row_data')
            .range(from, from + limit - 1);

        if (error) {
            console.error('Error fetching:', error.message);
            return;
        }

        if (data && data.length > 0) {
            allSheets = [...allSheets, ...data];
            from += limit;
            if (data.length < limit) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    console.log(`Fetched ${allSheets.length} rows.`);

    // Group by Content Key
    const groups: Record<string, any[]> = {};

    allSheets.forEach(sheet => {
        const row = sheet.row_data;
        if (!row) return;

        // Content Key
        const customer = row.Cliente || row.Nome || row.cliente || row.nome || '';
        const product = row.Produto || row.produto || '';
        const size = row.Tamanho || row.tamanho || '';
        const color = row.Cor || row.cor || '';
        const date = row.Data || row.data || '';

        // Only key if we have minimal data
        if (customer && product) {
            const key = `${customer}|${product}|${size}|${color}|${date}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(sheet);
        }
    });

    // Identify IDs to delete
    const idsToDelete: string[] = [];

    Object.entries(groups).forEach(([key, items]) => {
        if (items.length > 1) {
            // Sort by import_date DESC (Keep newest)
            // If import_date is same, keep first ID (doesn't matter)
            items.sort((a, b) => {
                const dateA = new Date(a.import_date || 0).getTime();
                const dateB = new Date(b.import_date || 0).getTime();
                return dateB - dateA;
            });

            // Keep index 0, delete others
            for (let i = 1; i < items.length; i++) {
                idsToDelete.push(items[i].id);
            }
        }
    });

    console.log(`Found ${idsToDelete.length} duplicate rows to delete.`);

    if (idsToDelete.length > 0) {
        console.log('Deleting duplicates...');

        // Batch delete
        const DELETE_BATCH = 100;
        for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH) {
            const batch = idsToDelete.slice(i, i + DELETE_BATCH);
            const { error: deleteError } = await newSupabase
                .from('spreadsheet_data')
                .delete()
                .in('id', batch);

            if (deleteError) console.error(`Error deleting batch ${i}:`, deleteError.message);
            else console.log(`   Deleted items ${i + 1} to ${Math.min(i + DELETE_BATCH, idsToDelete.length)}`);
        }
    } else {
        console.log('No duplicates to delete.');
    }
}

deduplicate();
