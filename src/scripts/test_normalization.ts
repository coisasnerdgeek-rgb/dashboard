import { createClient } from '@supabase/supabase-js';

// NEW DB Credentials
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function testNormalization() {
    console.log('--- Testing Key Normalization Logic ---');

    // Fetch one row
    const { data: sheetData, error } = await newSupabase
        .from('spreadsheet_data')
        .select('*')
        .limit(1);

    if (error || !sheetData || sheetData.length === 0) {
        console.error('Error fetching sample:', error?.message);
        return;
    }

    const row = sheetData[0].row_data;
    console.log('Original Keys:', Object.keys(row));

    const normalizeKeys = (row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase();
            newRow[lowerKey] = row[key];

            // Explicit Mappings for mismatches
            if (lowerKey === 'situação') newRow['situacao'] = row[key];
            if (lowerKey === 'identificador do pedido e-commerce' || lowerKey === 'numero da ordem de compra') {
                newRow['id'] = row[key];
            }
        });
        return newRow;
    };

    const normalized = normalizeKeys(row);
    console.log('Normalized Keys:', Object.keys(normalized));

    // CHECK SPECIFIC CRITICAL KEYS
    const criticalKeys = ['id', 'identificador do pedido e-commerce', 'canal', 'situacao', 'nome', 'produto'];

    console.log('\nCritical Key Check:');
    criticalKeys.forEach(key => {
        const exists = normalized.hasOwnProperty(key);
        console.log(`- '${key}': ${exists ? 'OK' : 'MISSING'}`);
        if (exists) console.log(`   Value: ${normalized[key]}`);
    });
}

testNormalization();
