/**
 * Script para migrar TODOS os dados de SPREADSHEET_DATA do banco antigo para o novo
 * Migra em lotes de 100 registros por vez para evitar timeout
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

const BATCH_SIZE = 100;

async function migrarSpreadsheetData() {
    console.log('🚀 Iniciando migração de SPREADSHEET_DATA...\n');

    try {
        // 1. Contar total de registros no banco antigo
        const { count, error: countError } = await oldSupabase
            .from('spreadsheet_data')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            throw new Error(`Erro ao contar registros: ${countError.message}`);
        }

        console.log(`📊 Total de registros no banco antigo: ${count}`);

        if (!count || count === 0) {
            console.log('⚠️  Nenhum registro encontrado no banco antigo!');
            return;
        }

        // 2. Migrar em lotes
        let offset = 0;
        let totalMigrados = 0;
        let totalErros = 0;

        while (offset < count) {
            console.log(`\n📦 Processando lote ${offset + 1} a ${Math.min(offset + BATCH_SIZE, count)}...`);

            // Buscar lote do banco antigo
            const { data: registros, error: fetchError } = await oldSupabase
                .from('spreadsheet_data')
                .select('*')
                .range(offset, offset + BATCH_SIZE - 1)
                .order('created_at', { ascending: true });

            if (fetchError) {
                console.error(`❌ Erro ao buscar lote: ${fetchError.message}`);
                totalErros += BATCH_SIZE;
                offset += BATCH_SIZE;
                continue;
            }

            if (!registros || registros.length === 0) {
                console.log('✅ Nenhum registro neste lote, avançando...');
                break;
            }

            // Inserir no banco novo
            const { error: insertError } = await newSupabase
                .from('spreadsheet_data')
                .upsert(registros, { onConflict: 'id' });

            if (insertError) {
                console.error(`❌ Erro ao inserir lote: ${insertError.message}`);
                totalErros += registros.length;
            } else {
                totalMigrados += registros.length;
                console.log(`✅ Migrados ${registros.length} registros com sucesso!`);
            }

            offset += BATCH_SIZE;

            // Aguardar um pouco para não sobrecarregar o Supabase
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 3. Resumo final
        console.log('\n' + '='.repeat(50));
        console.log('📊 RESUMO DA MIGRAÇÃO');
        console.log('='.repeat(50));
        console.log(`✅ Registros migrados com sucesso: ${totalMigrados}`);
        console.log(`❌ Registros com erro: ${totalErros}`);
        console.log(`📊 Total processado: ${totalMigrados + totalErros}`);
        console.log('='.repeat(50));

        // 4. Verificar no banco novo
        const { count: newCount } = await newSupabase
            .from('spreadsheet_data')
            .select('*', { count: 'exact', head: true });

        console.log(`\n✅ Total de registros no banco NOVO: ${newCount}`);

    } catch (error) {
        console.error('💥 Erro fatal na migração:', error);
        process.exit(1);
    }
}

// Executar
migrarSpreadsheetData()
    .then(() => {
        console.log('\n✅ Migração concluída!');
        console.log('\n📢 IMPORTANTE: Recarregue a página do dashboard (Ctrl+Shift+R) para ver os pedidos!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Erro:', error);
        process.exit(1);
    });
