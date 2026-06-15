
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
// Using SERVICE ROLE KEY to bypass RLS
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const supabase = createClient(NEW_SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function inspectRetryQueueAdmin() {
    console.log('Inspecting webhook_retry_queue (ADMIN)...');

    // Check total count
    const { count, error } = await supabase.from('webhook_retry_queue').select('*', { count: 'exact', head: true });
    if (error) console.error(error);
    console.log(`Total queue items: ${count}`);

    // Check status check
    const { count: pendingCount } = await supabase.from('webhook_retry_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    console.log(`Pending items: ${pendingCount}`);

    // Date range
    const { data: minDate } = await supabase.from('webhook_retry_queue').select('created_at').order('created_at', { ascending: true }).limit(1);
    console.log('Oldest created_at:', minDate?.[0]?.created_at);
}

inspectRetryQueueAdmin();
