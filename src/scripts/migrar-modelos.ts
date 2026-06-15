/**
 * Script para migrar MODELOS DE CAPINHAS com tratamento de conflito brand/model
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

async function migrarModelos() {
    console.log('📱 Migrando modelos de capinhas...\n');

    try {
        const { data: modelos, error: fetchError } = await oldSupabase.from('phone_case_models').select('*');
        if (fetchError) throw fetchError;

        if (!modelos || modelos.length === 0) {
            console.log('⚠️ Nenhum modelo encontrado.');
            return;
        }

        console.log(`📊 Encontrados ${modelos.length} modelos.`);

        // Ajustar para o schema do banco novo (que pode usar 'model' em vez de 'name')
        // Vamos verificar os campos do primeiro registro
        const keys = Object.keys(modelos[0]);
        console.log('Campos detectados no antigo:', keys);

        const dadosAjustados = modelos.map(m => {
            const { updated_at, ...resto } = m;
            return resto;
        });

        const { error: insError } = await newSupabase
            .from('phone_case_models')
            .upsert(dadosAjustados, { onConflict: 'brand, name' }); // Tentar brand, name primeiro

        if (insError) {
            console.log('⚠️ Falha no Upsert (brand, name). Tentando outro mapeamento...');
            const dadosFinal = modelos.map(m => ({
                brand: m.brand,
                name: m.name || m.model,
                in_stock: m.in_stock ?? true
            }));

            const { error: finalError } = await newSupabase.from('phone_case_models').upsert(dadosFinal, { onConflict: 'brand, name' });
            if (finalError) throw finalError;
        }

        console.log(`✅ ${modelos.length} modelos migrados com sucesso!`);

    } catch (e) {
        console.error('💥 Erro:', e);
    }
}

migrarModelos();
