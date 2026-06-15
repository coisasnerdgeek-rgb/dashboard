
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function inspectRetryQueue() {
    console.log('Inspecting webhook_retry_queue...');

    // Check total count
    const { count } = await supabase.from('webhook_retry_queue').select('*', { count: 'exact', head: true });
    console.log(`Total queue items: ${count}`);

    // Check sample row
    const { data: sample } = await supabase.from('webhook_retry_queue').select('*').limit(1);
    console.log('Sample row:', JSON.stringify(sample?.[0], null, 2));

    // Check dates distribution (min and max)
    const { data: minDate } = await supabase.from('webhook_retry_queue').select('created_at').order('created_at', { ascending: true }).limit(1);
    const { data: maxDate } = await supabase.from('webhook_retry_queue').select('created_at').order('created_at', { ascending: false }).limit(1);

    console.log('Oldest item:', minDate?.[0]?.created_at);
    console.log('Newest item:', maxDate?.[0]?.created_at);
}

inspectRetryQueue();
