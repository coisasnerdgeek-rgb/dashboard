
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://geabvcqcymaqsqxxfqyw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStatus() {
    console.log('--- Status Atual da Fila de Sincronização ---');

    const statuses = ['pending', 'processing', 'completed', 'failed'];

    for (const status of statuses) {
        const { count, error } = await supabase
            .from('webhook_retry_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', status);

        if (error) console.error(`Erro ao verificar ${status}:`, error.message);
        else console.log(`Status '${status.toUpperCase()}': ${count}`);
    }

    // Check progress of today's imports
    const today = new Date().toISOString().split('T')[0];
    const { count: importedToday } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true })
        .gte('import_date', today);

    console.log(`\n📦 Pedidos importados hoje (${today}): ${importedToday}`);
}

checkStatus().catch(console.error);
