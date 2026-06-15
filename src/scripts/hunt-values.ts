
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const supabase = createClient(NEW_SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function huntValues() {
    console.log('Hunting for 24k items...');

    // 1. Check 'queue' table again
    const { count: queueCount, error: qErr } = await supabase.from('queue').select('*', { count: 'exact', head: true });
    console.log(`Table 'queue': ${queueCount} (Error: ${qErr?.message || 'none'})`);

    // 2. Check 'saved_orders' total
    const { count: savedOrdersCount } = await supabase.from('saved_orders').select('*', { count: 'exact', head: true });
    console.log(`Table 'saved_orders': ${savedOrdersCount}`);

    // 3. Check 'spreadsheet_data' total
    const { count: spreadCount } = await supabase.from('spreadsheet_data').select('*', { count: 'exact', head: true });
    console.log(`Table 'spreadsheet_data': ${spreadCount}`);

    // 4. Check 'print_control' (Estamparia)
    const { count: printCount } = await supabase.from('print_control').select('*', { count: 'exact', head: true });
    console.log(`Table 'print_control': ${printCount}`);
}

huntValues();
