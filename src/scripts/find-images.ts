import { createClient } from '@supabase/supabase-js';

const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';
const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

async function findImages() {
    const { data } = await oldSupabase.from('spreadsheet_data').select('*').limit(50);
    const keysFound = new Set();
    data?.forEach(row => {
        if (row.row_data) {
            Object.keys(row.row_data).forEach(k => {
                if (k.toLowerCase().includes('imagem') || k.toLowerCase().includes('url') || k.toLowerCase().includes('link')) {
                    keysFound.add(k);
                    console.log(`Found image key: ${k} value: ${row.row_data[k]}`);
                }
            });
        }
    });
    console.log("Unique keys found:", Array.from(keysFound));
}

findImages();
