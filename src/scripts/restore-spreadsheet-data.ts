
import { createClient } from '@supabase/supabase-js';

// NEW DB (Service Key needed for high volume writes maybe? Or Anon is fine if RLS allows. Using Service for safety)
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// OLD DB
const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

async function restoreSpreadsheet() {
    console.log('🚀 Starting Restoration of spreadsheet_data...');

    // 1. Get Count
    const { count } = await oldSupabase.from('spreadsheet_data').select('*', { count: 'exact', head: true });
    console.log(`Total rows to restore: ${count}`);

    if (!count) return;

    const BATCH_SIZE = 500;
    let offset = 0;
    let totalMigrated = 0;

    // We can use a loop
    while (offset < count) {
        // Fetch from OLD
        const { data: rows, error: fetchError } = await oldSupabase
            .from('spreadsheet_data')
            .select('*')
            .range(offset, offset + BATCH_SIZE - 1);

        if (fetchError) {
            console.error('Fetch error:', fetchError);
            break;
        }

        if (rows && rows.length > 0) {
            // Insert into NEW
            // Using upsert to handle conflicts if any (conflict on 'id')
            const { error: insError } = await newSupabase
                .from('spreadsheet_data')
                .upsert(rows);

            if (insError) {
                console.error('Insert error:', insError);
                // Retry? Or skip?
                // If payload too large, 500 might be too big for rows with huge JSON.
                // But typically it's fine.
            } else {
                totalMigrated += rows.length;
            }
        }

        console.log(`Progress: ${totalMigrated}/${count}`);
        offset += BATCH_SIZE;

        // Anti-rate limit delay?
        if (totalMigrated % 5000 === 0) await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`✅ Restore Completed. Transferred ${totalMigrated} rows.`);
}

restoreSpreadsheet();
