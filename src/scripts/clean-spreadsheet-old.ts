
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function cleanSpreadsheet() {
    console.log('Cleaning spreadsheet_data (import_date <= 25/01/2026)...');

    // Check distribution
    const { data: minDate } = await supabase.from('spreadsheet_data').select('import_date').order('import_date', { ascending: true }).limit(1);
    console.log(`Oldest Import: ${minDate?.[0]?.import_date}`);

    // Cutoff: 2026-01-25 23:59:59
    const cutOff = '2026-01-25T23:59:59.999Z';

    // Count to delete
    const { count } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true })
        .lte('import_date', cutOff);

    console.log(`Found ${count} old spreadsheet rows to delete.`);

    if (!count || count === 0) return;

    // Delete efficiently? DELETE where import_date < cutOff
    // Since we have 61k rows and maybe 40k are old, bulk delete might timeout.
    // But let's try direct delete first.

    const { error: delError, count: delCount } = await supabase
        .from('spreadsheet_data')
        .delete({ count: 'exact' })
        .lte('import_date', cutOff);

    if (delError) {
        console.error('Bulk delete failed:', delError);
        // Fallback to batches
    } else {
        console.log(`Successfully deleted ${delCount} rows.`);
    }
}

cleanSpreadsheet();
