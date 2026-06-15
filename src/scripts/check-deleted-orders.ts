
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://geabvcqcymaqsqxxfqyw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxODEwOTcsImV4cCI6MjA4NDc1NzA5N30.U6JWAUQgMMj_u6S7ZHisf9vG-LL0IwM5QyoD5OT97Ro";

async function checkDeletedOrders() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('--- DELETED ORDERS ---');
    const { data: deleted, error: dError } = await supabase
        .from('deleted_orders')
        .select('*')
        .limit(10);

    if (dError) console.error(dError);
    else console.log(JSON.stringify(deleted, null, 2));

    console.log('--- SPREADSHEET DATA ---');
    const { data: spreadsheetData, error: sError } = await supabase
        .from('spreadsheet_data')
        .select('id, filename, row_data->ID Tiny')
        .limit(10);

    if (sError) console.error(sError);
    else console.log(JSON.stringify(spreadsheetData, null, 2));
}

checkDeletedOrders();
