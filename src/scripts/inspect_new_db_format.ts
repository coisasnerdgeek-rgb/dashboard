import { createClient } from '@supabase/supabase-js';

// NEW DB Credentials
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function inspect() {
    console.log('--- Inspecting NEW DB Data Structure ---');

    // Check Spreadsheet Data
    const { data: sheetData, error: sheetError } = await newSupabase
        .from('spreadsheet_data')
        .select('*')
        .limit(1);

    if (sheetData && sheetData.length > 0) {
        console.log('\n[Spreadsheet Data Sample]');
        const row = sheetData[0].row_data || {};
        Object.entries(row).forEach(([key, value]) => {
            console.log(`"${key}": "${value}"`);
        });
    }
}

inspect();
