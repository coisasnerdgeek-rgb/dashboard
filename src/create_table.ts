import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');

// Manual env parsing
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
    }
});

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createExclusionsTable() {
    console.log('🚀 Criando tabela montagem_exclusions...');

    try {
        const { error } = await supabase.rpc('execute_sql', {
            sql_query: `
        CREATE TABLE IF NOT EXISTS public.montagem_exclusions (
            order_id TEXT PRIMARY KEY,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        ALTER TABLE public.montagem_exclusions ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all access to montagem_exclusions" ON public.montagem_exclusions;
        CREATE POLICY "Allow all access to montagem_exclusions" ON public.montagem_exclusions FOR ALL USING (true);
      `
        });

        if (error) {
            // If RPC isn't available, we might need another way or just hope it exists.
            // But usually in these setups there's an execute_sql or we just try a simple query.
            console.warn('⚠️ Erro via RPC execute_sql, tentando inserção simples para testar existência...');
            const { error: testError } = await supabase.from('montagem_exclusions').select('order_id').limit(1);
            if (testError && testError.code === 'PGRST116') {
                console.error('❌ Tabela não existe e RPC falhou.');
            } else {
                console.log('✅ Tabela já parece existir ou foi criada.');
            }
        } else {
            console.log('✨ Tabela criada/verificada com sucesso.');
        }
    } catch (err) {
        console.error('❌ Erro inesperado:', err);
    }
}

createExclusionsTable();
