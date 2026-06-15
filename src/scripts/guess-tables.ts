import { createClient } from '@supabase/supabase-js';

const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

async function listAllTables() {
    const { data, error } = await oldSupabase.rpc('get_tables_info'); // If rpc exists, but probably not.
    // Let's use raw SQL if possible or a trick with a common table.
    // Since I can't run raw SQL easily via client without RPC, I'll try to guess common names.
    const guesses = ['images', 'image_library', 'product_images', 'estampas_images', 'image_mappings', 'image_categories'];
    for (const g of guesses) {
        const { count } = await oldSupabase.from(g).select('*', { count: 'exact', head: true });
        if (count !== null) console.log(`${g}: ${count} rows`);
    }
}

listAllTables();
