/**
 * Script para migrar as tabelas de IMAGENS do banco antigo para o novo
 * Migra: image_categories e image_mappings
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

async function migrarBibliotecaImagens() {
    console.log('🖼️ Iniciando migração da Biblioteca de Imagens...\n');

    try {
        // 1. LIMPAR TABELAS NO BANCO NOVO (Para evitar mistura com dados errados)
        console.log('🧹 Limpando dados atuais no banco novo...');
        await newSupabase.from('image_mappings').delete().neq('sku', 'ROOT_DELETE_ALL');
        await newSupabase.from('image_categories').delete().neq('id', 'ROOT_DELETE_ALL');

        // 2. MIGRAR IMAGE_CATEGORIES
        console.log('📁 Migrando categorias...');
        const { data: categories, error: catError } = await oldSupabase.from('image_categories').select('*');
        if (catError) throw catError;

        if (categories && categories.length > 0) {
            const { error: insCatError } = await newSupabase.from('image_categories').insert(categories);
            if (insCatError) throw insCatError;
            console.log(`✅ ${categories.length} categorias migradas!`);
        }

        // 3. MIGRAR IMAGE_MAPPINGS (em lotes)
        console.log('🖼️ Migrando mappings de imagens...');
        const { count, error: countError } = await oldSupabase
            .from('image_mappings')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;
        console.log(`📊 Total de mapeamentos: ${count}`);

        const BATCH_SIZE = 1000;
        let offset = 0;
        while (offset < (count || 0)) {
            const { data: mappings, error: fetchError } = await oldSupabase
                .from('image_mappings')
                .select('*')
                .range(offset, offset + BATCH_SIZE - 1);

            if (fetchError) throw fetchError;

            if (mappings && mappings.length > 0) {
                const { error: insMapError } = await newSupabase.from('image_mappings').insert(mappings);
                if (insMapError) throw insMapError;
                console.log(`📦 Lote ${offset / BATCH_SIZE + 1} concluído (${mappings.length} imagens)`);
            }
            offset += BATCH_SIZE;
        }

        console.log('\n✨ Migração de imagens concluída com sucesso!');

    } catch (error) {
        console.error('💥 Erro na migração de imagens:', error);
    }
}

migrarBibliotecaImagens();
