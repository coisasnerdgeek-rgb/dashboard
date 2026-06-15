import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function checkImageSchema() {
    console.log('--- image_categories ---');
    const { data: catData, error: catError } = await newSupabase.from('image_categories').select('*').limit(1);
    console.log('Data:', catData);
    console.log('Error:', catError);

    console.log('\n--- image_mappings ---');
    const { data: mapData, error: mapError } = await newSupabase.from('image_mappings').select('*').limit(1);
    console.log('Data:', mapData);
    console.log('Error:', mapError);
}

checkImageSchema();
