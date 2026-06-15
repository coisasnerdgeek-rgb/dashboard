import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function fixSchema() {
    console.log('🔧 Tentando forçar atualização do schema...');

    // Pequeno truque: renomear e renomear de volta a coluna às vezes força o PostgREST a atualizar o cache
    // Mas não podemos fazer isso via client.

    // Vamos tentar um INSERT direto de um item dummy para ver se o erro persiste
    const { error } = await newSupabase.from('backordered_items').upsert([{
        id: 'test-sync-' + Date.now(),
        data_json: { test: true },
        is_resolved: false
    }]);

    if (error) {
        console.error('❌ Erro no teste de insert:', error);
    } else {
        console.log('✅ Inserção de teste com sucesso! O schema está ok.');
    }
}

fixSchema();
