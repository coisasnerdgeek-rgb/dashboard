/**
 * Script para migrar a tabela PRINT_CONTROL do banco antigo para o novo
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

async function migrarPrintControl() {
    console.log('👕 Iniciando migração de PRINT_CONTROL (Estamparia)...\n');

    try {
        const { count, error: countError } = await oldSupabase
            .from('print_control')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;
        console.log(`📊 Total de registros encontrados: ${count}`);

        if (!count || count === 0) {
            console.log('⚠️ Nenhum registro para migrar.');
            return;
        }

        const BATCH_SIZE = 100;
        let offset = 0;
        let totalMigrados = 0;

        while (offset < count) {
            const { data: registros, error: fetchError } = await oldSupabase
                .from('print_control')
                .select('*')
                .range(offset, offset + BATCH_SIZE - 1);

            if (fetchError) throw fetchError;

            if (registros && registros.length > 0) {
                const { error: insError } = await newSupabase
                    .from('print_control')
                    .upsert(registros, { onConflict: 'order_id' }); // order_id é único nesta tabela

                if (insError) throw insError;
                totalMigrados += registros.length;
                console.log(`✅ Lote concluído: ${totalMigrados}/${count}`);
            }
            offset += BATCH_SIZE;
        }

        // Também migrar sku_mappings (são as correções de cor/produto)
        console.log('\n🎨 Migrando SKU_MAPPINGS...');
        const { data: skus, error: skuError } = await oldSupabase.from('sku_mappings').select('*');
        if (skuError) throw skuError;
        if (skus && skus.length > 0) {
            const { error: insSku } = await newSupabase.from('sku_mappings').upsert(skus, { onConflict: 'mapping_type, mapping_key' });
            if (insSku) throw insSku;
            console.log(`✅ ${skus.length} mapeamentos de SKU migrados!`);
        }

        console.log('\n✨ Migração concluída com sucesso!');

    } catch (error) {
        console.error('💥 Erro na migração:', error);
    }
}

migrarPrintControl();
