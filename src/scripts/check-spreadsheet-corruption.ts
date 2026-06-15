
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function checkSpreadsheetData() {
    console.log('Checking spreadsheet_data...');

    // 1. Check for 'undefined' in relevant columns
    // We need to know column names first. Usually: 'Identificador do pedido e-commerce', 'Cliente'
    // But since it's JSON-based or dynamic columns in Supabase? No, usually text columns.

    // Let's get one row to see keys
    const { data: sample } = await supabase.from('spreadsheet_data').select('*').limit(1);
    const keys = sample && sample[0] ? Object.keys(sample[0]) : [];
    console.log('Columns:', keys);

    // Assuming standard column names mapped from normalized CSV
    const idCol = keys.find(k => k.toLowerCase().includes('identificador') || k.toLowerCase().includes('pedido')) || 'Identificador do pedido e-commerce';
    const clientCol = keys.find(k => k.toLowerCase().includes('cliente')) || 'Cliente';

    console.log(`Using ID Col: "${idCol}", Client Col: "${clientCol}"`);

    // 2. Count "undefined" literal strings
    const { count: undefinedCount } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true })
        .or(`"${idCol}".ilike.%undefined%`); // Check ID column for string "undefined"

    console.log(`Rows with "undefined" in ID: ${undefinedCount}`);

    // 3. Count rows with missing essential data
    const { count: emptyCount } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true })
        .is(idCol, null);

    console.log(`Rows with NULL ID: ${emptyCount}`);

    // 4. Check "Vitor Bruel" specifically for the duplication issue
    const { data: vitor } = await supabase
        .from('spreadsheet_data')
        .select('*')
        .ilike(clientCol, '%Vitor Bruel%')
        .limit(5);

    console.log(`Sample Vitor Bruel rows:`, vitor?.length);
    if (vitor?.length) {
        console.log('Sample row:', JSON.stringify(vitor[0], null, 2));
    }
}

checkSpreadsheetData();
