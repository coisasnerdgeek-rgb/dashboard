/**
 * Script para migrar a tabela DELETED_ORDERS do banco antigo para o novo
 */

import { createClient } from '@supabase/supabase-js';

// Banco ANTIGO (nbxubdmsepnhhhsbpzoq)
const OLD_SUPABASE_URL = 'https://nbxubdmsepnhhhsbpzoq.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ieHViZG1zZXBuaGhoc2Jwem9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI1MzUwMiwiZXhwIjoyMDc2ODI5NTAyfQ.Lx2H2dHbphpTOlH0PKd-v4E7kJGarU4hYMKLrWBH6us';

// Banco NOVO (geabvcqcymaqsqxxfqyw)
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function migrarDeletedOrders() {
    console.log('🗑️ Iniciando migração de DELETED_ORDERS...\n');

    try {
        const { count, error: countError } = await oldSupabase
            .from('deleted_orders')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;
        console.log(`📊 Total de registros encontrados: ${count}`);

        if (!count || count === 0) {
            console.log('⚠️ Nenhum registro para migrar.');
            return;
        }

        const BATCH_SIZE = 200;
        let offset = 0;
        let totalMigrados = 0;

        while (offset < count) {
            const { data: registros, error: fetchError } = await oldSupabase
                .from('deleted_orders')
                .select('*')
                .range(offset, offset + BATCH_SIZE - 1);

            if (fetchError) throw fetchError;

            if (registros && registros.length > 0) {
                // Acomodar diferenças de colunas
                // No novo banco order_id é PK. Se houver 'id', remover.
                const dadosAjustados = registros.map(item => {
                    const { id, tiny_id, ...resto } = item;
                    return {
                        ...resto,
                        order_id: item.order_id || item.id,
                        // Se 'order_data' não existir no antigo, podemos ignorar ou preencher
                        // Mas 'reason' e 'order_data' parecem ser opcionais no novo schema
                    };
                });

                const { error: insError } = await newSupabase
                    .from('deleted_orders')
                    .upsert(dadosAjustados, { onConflict: 'order_id' });

                if (insError) {
                    console.error(`❌ Erro no lote ${offset}:`, insError);
                    // Tentar um por um se falhar em lote por duplicata ou restrição
                } else {
                    totalMigrados += registros.length;
                    console.log(`✅ Lote concluído: ${totalMigrados}/${count}`);
                }
            }
            offset += BATCH_SIZE;
        }

        console.log('\n✨ Migração de deleted_orders concluída!');

    } catch (error) {
        console.error('💥 Erro fatal na migração:', error);
    }
}

migrarDeletedOrders();
