import { createClient } from '@supabase/supabase-js';

// NEW DB Credentials
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function deleteBadSources() {
    console.log('--- Deleting Script-Imported Data (RESTORED_DATA_V2) ---');

    const filenameToDelete = 'RESTORED_DATA_V2.xlsx';

    // 1. Count before
    const { count: countBefore, error: countError } = await newSupabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true })
        .eq('filename', filenameToDelete);

    if (countError) {
        console.error('Error counting target rows:', countError);
        return;
    }

    console.log(`Identified ${countBefore} rows with filename: "${filenameToDelete}"`);

    if (!countBefore || countBefore === 0) {
        console.log('Nothing to delete.');
        return;
    }

    // 2. Delete
    const { error: deleteError } = await newSupabase
        .from('spreadsheet_data')
        .delete()
        .eq('filename', filenameToDelete);

    if (deleteError) {
        console.error('Error deleting rows:', deleteError);
        return;
    }

    console.log('Successfully deleted rows.');

    // 3. Verify Remaining Sources
    const { data: remaining, error: listError } = await newSupabase
        .from('spreadsheet_data')
        .select('filename');

    if (remaining) {
        const unique = [...new Set(remaining.map(r => r.filename))];
        console.log('Remaining files in DB:', unique);
    }
}

deleteBadSources();
