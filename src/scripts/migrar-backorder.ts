/**
 * Script para migrar a tabela BACKORDERED_ITEMS do banco antigo para o novo
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

async function migrarBackorder() {
    console.log('📦 Iniciando migração de BACKORDERED_ITEMS...\n');

    try {
        const { data: itens, error: fetchError } = await oldSupabase
            .from('backordered_items')
            .select('*');

        if (fetchError) throw fetchError;

        if (!itens || itens.length === 0) {
            console.log('⚠️ Nenhum item de backorder encontrado para migrar.');
            return;
        }

        console.log(`📊 Encontrados ${itens.length} itens na tabela de backorder.`);

        // Remover o campo updated_at se ele estiver causando problema de cache no schema novo
        const itensProcessados = itens.map(item => {
            const { updated_at, ...resto } = item;
            return resto;
        });

        const { error: insError } = await newSupabase
            .from('backordered_items')
            .upsert(itensProcessados, { onConflict: 'id' });

        if (insError) throw insError;

        console.log(`✅ ${itens.length} registros de backorder migrados com sucesso!`);

    } catch (error) {
        console.error('💥 Erro na migração de backorder:', error);
    }
}

migrarBackorder();
