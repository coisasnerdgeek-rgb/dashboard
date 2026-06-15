/**
 * Script para migrar a tabela PRICE_TABLES do banco antigo para o novo
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

async function migrarPrecos() {
    console.log('💰 Iniciando migração de PRICE_TABLES...\n');

    try {
        const { data: precos, error: fetchError } = await oldSupabase
            .from('price_tables')
            .select('*');

        if (fetchError) throw fetchError;

        if (!precos || precos.length === 0) {
            console.log('⚠️ Nenhum preço encontrado para migrar.');
            return;
        }

        console.log(`📊 Encontrados ${precos.length} produtos na tabela de preços.`);

        // Remover campos que causam erro de schema no banco novo
        const precosAjustados = precos.map(p => {
            const { updated_at, ...resto } = p;
            return resto;
        });

        const { error: insError } = await newSupabase
            .from('price_tables')
            .upsert(precosAjustados, { onConflict: 'id' });

        if (insError) throw insError;

        console.log(`✅ ${precos.length} registros de preços migrados com sucesso!`);

    } catch (error) {
        console.error('💥 Erro na migração de preços:', error);
    }
}

migrarPrecos();
