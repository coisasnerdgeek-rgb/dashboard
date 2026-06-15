
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function inspectQueue() {
    console.log('Inspecting queue table...');

    // Check total count
    const { count } = await supabase.from('queue').select('*', { count: 'exact', head: true });
    console.log(`Total queue items: ${count}`);

    // Check sample row to see date column
    const { data: sample } = await supabase.from('queue').select('*').limit(1);
    console.log('Sample row:', JSON.stringify(sample?.[0], null, 2));
}

inspectQueue();
