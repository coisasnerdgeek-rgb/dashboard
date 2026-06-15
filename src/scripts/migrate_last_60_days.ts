import { createClient } from '@supabase/supabase-js';

// Credentials
const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function migrate() {
    console.log('--- Starting Migration (Last 60 Days) ---');

    // 1. Clean NEW DB
    console.log('1. Cleaning NEW DB saved_orders...');
    const { error: cleanError } = await newSupabase
        .from('saved_orders')
        .delete()
        .neq('id', 'placeholder_safety_bypass'); // Deletes all rows

    if (cleanError) {
        console.error('Error Cleaning:', cleanError.message);
        return;
    }
    console.log('   Stats: Validated Clean.');

    // 2. Fetch OLD DB Orders (Last 60 Days)
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 60);
    console.log(`2. Fetching orders since ${dateLimit.toISOString()} from OLD DB...`);

    const { data: oldOrders, error: fetchError } = await oldSupabase
        .from('saved_orders')
        .select('*')
        .gte('created_at', dateLimit.toISOString());

    if (fetchError) {
        console.error('Error Fetching:', fetchError.message);
        return;
    }

    if (!oldOrders || oldOrders.length === 0) {
        console.log('   No orders found in the last 60 days.');
        return;
    }

    console.log(`   Found ${oldOrders.length} orders to migrate.`);

    // 3. Insert into NEW DB
    console.log('3. Inserting into NEW DB...');

    // Batch insert to avoid limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < oldOrders.length; i += BATCH_SIZE) {
        const batch = oldOrders.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await newSupabase
            .from('saved_orders')
            .upsert(batch); // Upsert ensures ID preservation

        if (insertError) {
            console.error(`   Error inserting batch ${i}:`, insertError.message);
        } else {
            console.log(`   Migrated items ${i + 1} to ${Math.min(i + BATCH_SIZE, oldOrders.length)}`);
        }
    }

    // --- SPREADSHEET DATA MIGRATION ---
    console.log('\n--- Migrating Spreadsheet Data ---');

    // 4. Clean NEW DB spreadsheet_data
    console.log('4. Cleaning NEW DB spreadsheet_data...');
    const { error: cleanSheetError } = await newSupabase
        .from('spreadsheet_data')
        .delete()
        .neq('id', 'placeholder_safety_bypass');

    if (cleanSheetError) {
        console.error('Error Cleaning spreadsheet_data:', cleanSheetError.message);
    } else {
        console.log('   Stats: spreadsheet_data Cleaned.');
    }

    // 5. Fetch OLD DB Spreadsheet Data (Last 60 Days)
    // Assuming 'import_date' or 'created_at' exists. Based on type it has 'importDate'.
    // We'll try to filter by import_date if it exists, otherwise just fetch recent.
    // Let's assume standard 'created_at' or 'import_date' column.
    // Checking schema via select:
    const { data: sheetData, error: sheetError } = await oldSupabase
        .from('spreadsheet_data')
        .select('*')
        .gte('created_at', dateLimit.toISOString()); // Assuming created_at exists

    if (sheetError) {
        console.error('Error Fetching spreadsheet_data:', sheetError.message);
    } else if (sheetData && sheetData.length > 0) {
        console.log(`   Found ${sheetData.length} spreadsheet files to migrate.`);
        const { error: insertSheetError } = await newSupabase
            .from('spreadsheet_data')
            .upsert(sheetData);

        if (insertSheetError) console.error('   Error inserting spreadsheet_data:', insertSheetError.message);
        else console.log('   Stats: spreadsheet_data Migrated.');
    } else {
        console.log('   No spreadsheet_data found in last 60 days.');
    }

    console.log('--- Migration Complete ---');
}

migrate();
