/**
 * Script para migrar as tabelas restantes (Configurações, Modelos de Capinhas e Categorias de Imagem)
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

async function migrarRestantes() {
    console.log('🔄 Iniciando migração das tabelas restantes...\n');

    const tabelas = [
        { nome: 'image_categories', pk: 'id' },
        { nome: 'phone_case_models', pk: 'id' },
        { nome: 'app_settings', pk: 'key' },
        { nome: 'tracking_mappings', pk: 'sku' }
    ];

    for (const { nome, pk } of tabelas) {
        try {
            console.log(`📡 Migrando ${nome}...`);
            const { data, error: fetchError } = await oldSupabase.from(nome).select('*');

            if (fetchError) {
                console.error(`❌ Erro ao buscar ${nome}:`, fetchError.message);
                continue;
            }

            if (!data || data.length === 0) {
                console.log(`⚠️ Nenhum registro em ${nome}.`);
                continue;
            }

            // Remover campos que podem causar conflito de schema se necessário
            const dadosLimpos = data.map(item => {
                const { updated_at, ...resto } = item;
                return resto;
            });

            const { error: insError } = await newSupabase.from(nome).upsert(dadosLimpos, { onConflict: pk });

            if (insError) {
                console.error(`❌ Erro ao migrar ${nome}:`, insError.message);
            } else {
                console.log(`✅ ${data.length} registros migrados em ${nome}!`);
            }
        } catch (e) {
            console.error(`💥 Erro fatal em ${nome}:`, e);
        }
    }

    console.log('\n✨ Migração concluída!');
}

migrarRestantes();
