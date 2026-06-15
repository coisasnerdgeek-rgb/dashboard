import { createClient } from '@supabase/supabase-js';

// NEW DB Credentials
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function diagnose() {
    console.log('--- Diagnosing Duplicates in spreadsheet_data ---');

    let allSheets: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await newSupabase
            .from('spreadsheet_data')
            .select('id, import_date, row_data')
            .range(from, from + limit - 1);

        if (error) {
            console.error('Error fetching sheets:', error.message);
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

    const sheets = allSheets;
    console.log(`Fetched ${sheets.length} spreadsheet records.`);

    const allRowIds: Record<string, number> = {};
    let totalRows = 0;

    sheets.forEach(sheet => {
        const row = sheet.row_data;
        if (!row) return;

        // Generate Content Key to find duplicates ignoring the generated ID
        // Key: Customer + Product + Size + Color + Date
        const customer = row.Cliente || row.Nome || row.cliente || row.nome || '';
        const product = row.Produto || row.produto || '';
        const size = row.Tamanho || row.tamanho || '';
        const color = row.Cor || row.cor || '';

        // Data format normalization might be needed if format varies
        const date = row.Data || row.data || '';

        const contentKey = `${customer}|${product}|${size}|${color}|${date}`;

        // Only count if key has meaningful data
        if (customer && product) {
            if (!allRowIds[contentKey]) allRowIds[contentKey] = 0;
            allRowIds[contentKey]++;
        }
        totalRows++;
    });

    console.log(`Total Flattened Rows: ${totalRows}`);

    // Count duplicates
    const duplicateKeys = Object.entries(allRowIds).filter(([_, count]) => count > 1);
    console.log(`Found ${duplicateKeys.length} unique CONTENT sets that appear multiple times.`);

    if (duplicateKeys.length > 0) {
        console.log('Top 5 Content Duplicates:');
        duplicateKeys.sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([key, count]) => {
            console.log(`   Key: ${key.substring(0, 50)}... - Count: ${count}`);
        });
    } else {
        console.log('No content duplicates found.');
    }
}

diagnose();
