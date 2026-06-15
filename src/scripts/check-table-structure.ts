import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas no .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure() {
    console.log('🔍 Verificando estrutura da tabela saved_orders...\n');

    try {
        // Get a sample record to see structure
        const { data, error } = await supabase
            .from('saved_orders')
            .select('*')
            .limit(1);

        if (error) {
            console.error('❌ Erro ao buscar dados:', error.message);
            return;
        }

        if (!data || data.length === 0) {
            console.log('⚠️  Nenhum registro encontrado na tabela');
            return;
        }

        console.log('✅ Estrutura da tabela saved_orders:');
        console.log('Colunas disponíveis:', Object.keys(data[0]));
        console.log('\nExemplo de registro:');
        console.log(JSON.stringify(data[0], null, 2));

        // Check if created_at exists
        if ('created_at' in data[0]) {
            console.log('\n✅ Coluna created_at EXISTE');
        } else {
            console.log('\n⚠️  Coluna created_at NÃO EXISTE');
            console.log('   Será necessário criar antes de implementar paginação');
        }

    } catch (err) {
        console.error('❌ Erro inesperado:', err);
    }
}

checkTableStructure();
