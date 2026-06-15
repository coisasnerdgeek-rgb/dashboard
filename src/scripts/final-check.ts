import { createClient } from '@supabase/supabase-js';

const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

async function finalCheck() {
    const res1 = await oldSupabase.from('image_mappings').select('*', { count: 'exact' });
    console.log('image_mappings data:', res1.data?.length, 'count:', res1.count);

    const res2 = await oldSupabase.from('image_categories').select('*', { count: 'exact' });
    console.log('image_categories data:', res2.data?.length, 'count:', res2.count);
}

finalCheck();
