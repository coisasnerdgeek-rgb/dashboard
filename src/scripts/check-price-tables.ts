import { createClient } from '@supabase/supabase-js';

const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

async function checkPriceTable() {
    const { count, error } = await oldSupabase.from('price_tables').select('*', { count: 'exact', head: true });
    console.log(`price_tables: ${count} rows (Error: ${error?.message || 'none'})`);

    if (count && count > 0) {
        const { data } = await oldSupabase.from('price_tables').select('*').limit(5);
        console.log('Sample rows:', JSON.stringify(data, null, 2));
    }
}

checkPriceTable();
