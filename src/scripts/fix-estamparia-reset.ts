
import { createClient } from '@supabase/supabase-js';

// NEW DB
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

// OLD DB
const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

async function resetEstamparia() {
    console.log('🚨 STARTING ESTAMPARIA RESET...');

    // 1. Clear NEW table (or maybe just delete rows that don't satisfy criteria? No, user wants reorganization)
    console.log('🗑️ Clearing print_control on NEW DB...');
    const { error: delError } = await newSupabase.from('print_control').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (delError) {
        console.error('Error deleting:', delError);
        return;
    }
    console.log('✅ Table cleared.');

    // 2. Fetch from OLD DB
    console.log('📥 Fetching from OLD DB...');
    const { count } = await oldSupabase.from('print_control').select('*', { count: 'exact', head: true });

    if (!count) {
        console.log('No rows in old DB? Aborting.');
        return;
    }
    console.log(`Found ${count} rows to migrate.`);

    const BATCH_SIZE = 200;
    let offset = 0;
    let total = 0;

    while (offset < count) {
        const { data: rows, error: fetchError } = await oldSupabase
            .from('print_control')
            .select('*')
            .range(offset, offset + BATCH_SIZE - 1);

        if (fetchError) throw fetchError;

        if (rows && rows.length > 0) {
            // Clean rows (remove id if we want new ones? No, keep IDs for consistency if possible)
            // But we might need to handle 'created_at' if we want to preserve history.

            const { error: insError } = await newSupabase.from('print_control').upsert(rows);
            if (insError) console.error('Error inserting batch:', insError);
            else total += rows.length;
        }

        console.log(`Progress: ${Math.min(offset + BATCH_SIZE, count)}/${count}`);
        offset += BATCH_SIZE;
    }

    console.log(`✅ Successfully restored ${total} rows from backup.`);
}

resetEstamparia();
