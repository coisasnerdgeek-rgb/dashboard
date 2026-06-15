import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function checkFinalCounts() {
    const tables = ['image_categories', 'image_mappings', 'payments', 'verification_status', 'phone_case_models', 'tracking_mappings', 'app_settings'];
    console.log('--- RELATÓRIO DE IMPORTAÇÃO (BANCO NOVO) ---');

    for (const table of tables) {
        const { count, error } = await newSupabase.from(table).select('*', { count: 'exact', head: true });
        console.log(`${table}: ${count || 0} registros ${error ? '(Erro: ' + error.message + ')' : ''}`);
    }
}

checkFinalCounts();
