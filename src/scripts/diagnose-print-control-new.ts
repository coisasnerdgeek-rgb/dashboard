
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function diagnose() {
    console.log('Diagnosing print_control on NEW DB...');

    // 1. Total Count
    const { count, error } = await supabase.from('print_control').select('*', { count: 'exact', head: true });
    if (error) {
        console.error('Error counting:', error);
        return;
    }
    console.log(`Total rows: ${count}`);

    // 2. Status Distribution
    // We can't do group by easily with PostgREST without rpc, so we fetch all statuses (limit to 10000 for safety)
    const { data, error: dataError } = await supabase.from('print_control').select('status');
    if (dataError) {
        console.error('Error fetching data:', dataError);
    } else {
        const counts: Record<string, number> = {};
        data?.forEach(row => {
            const s = row.status || 'NULL';
            counts[s] = (counts[s] || 0) + 1;
        });
        console.log('Status Counts:', counts);
    }

    // 3. Sample
    const { data: sample } = await supabase.from('print_control').select('*').limit(3);
    console.log('Sample:', JSON.stringify(sample, null, 2));
}

diagnose();
