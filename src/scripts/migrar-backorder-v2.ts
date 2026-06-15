import { createClient } from '@supabase/supabase-js';

// Banco ANTIGO (nbxubdmsepnhhhsbpzoq)
const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';

// Banco NOVO (geabvcqcymaqsqxxfqyw)
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function migrarBackorder() {
    console.log('📦 Iniciando migração de BACKORDERED_ITEMS...\n');

    try {
        const { data: itens, error: fetchError } = await oldSupabase
            .from('backordered_items')
            .select('*');

        if (fetchError) throw fetchError;
        console.log(`📊 Encontrados ${itens.length} itens na tabela de backorder.`);

        // Testar se o banco novo aceita 'original_row' em vez de 'data_json'
        const itensProcessados = itens.map(item => {
            const { data_json, updated_at, ...resto } = item;
            return {
                ...resto,
                original_row: data_json // Tentar coluna do schema que costuma existir
            };
        });

        const { error } = await newSupabase.from('backordered_items').upsert(itensProcessados, { onConflict: 'id' });

        if (error) {
            console.error('❌ Ambos falharam (data_json e original_row):', error);
            console.log('\n💡 Sugestão: Execute o SQL de criação de tabela manualmente no dashboard do Supabase para corrigir o cache.');
        } else {
            console.log(`✅ ${itens.length} registros de backorder migrados com sucesso (via original_row)!`);
        }

    } catch (e) {
        console.error('Erro:', e);
    }
}

migrarBackorder();
