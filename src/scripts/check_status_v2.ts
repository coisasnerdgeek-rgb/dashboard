import { createClient } from '@supabase/supabase-js';

// NEW DB Credentials
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function checkStatus() {
    console.log('--- Checking NEW Database Status (Spreadsheet Data Content) ---');

    // Get sample rows
    const { data } = await newSupabase.from('spreadsheet_data').select('rows').limit(1);

    if (data && data.length > 0 && data[0].rows && data[0].rows.length > 0) {
        console.log('Sample Order ID from spreadsheet_data:', data[0].rows[0].id || 'No ID');
        console.log('Sample Order Data from spreadsheet_data:', data[0].rows[0]['Data'] || data[0].rows[0]['data'] || 'No Data');
    } else {
        console.log('No rows found inside spreadsheet_data.');
    }
}

checkStatus();
