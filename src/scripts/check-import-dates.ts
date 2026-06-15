/**
 * Verificar import_date dos pedidos recentes
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = value;
        }
    });
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkImportDates() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔍 Verificando import_date dos Pedidos Recentes\n');
    console.log('='.repeat(60) + '\n');

    // Buscar pedidos dos dias 28 e 29
    const dates = ['28/01/2026', '29/01/2026'];

    for (const date of dates) {
        console.log(`📅 Pedidos de ${date}:\n`);

        const { data, error, count } = await supabase
            .from('spreadsheet_data')
            .select('id, import_date, row_data', { count: 'exact' })
            .eq('row_data->>Data', date)
            .order('import_date', { ascending: false })
            .limit(10);

        if (error) {
            console.error(`   ❌ Erro:`, error);
            continue;
        }

        console.log(`   Total: ${count || 0} pedidos\n`);

        if (data && data.length > 0) {
            console.log(`   Primeiros registros:`);
            data.forEach((row: any, idx: number) => {
                const importDate = new Date(row.import_date);
                const now = new Date();
                const diffHours = Math.floor((now.getTime() - importDate.getTime()) / (1000 * 60 * 60));

                console.log(`   ${idx + 1}. ID Tiny: ${row.row_data['ID Tiny']}`);
                console.log(`      import_date: ${row.import_date} (${diffHours}h atrás)`);
                console.log(`      SKU: ${row.row_data['SKU']}`);
                console.log(``);
            });
        } else {
            console.log(`   ⚠️  Nenhum pedido encontrado!\n`);
        }
    }

    // Verificar filtro de 60 dias
    console.log('⏰ Verificando Filtro de 60 Dias:\n');

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const cutOffDate = sixtyDaysAgo.toISOString();

    console.log(`   Data de corte: ${cutOffDate}`);
    console.log(`   (Apenas pedidos COM import_date APÓS essa data são carregados)\n`);

    // Contar quantos pedidos têm import_date recente
    const { count: recentCount } = await supabase
        .from('spreadsheet_data')
        .select('id', { count: 'exact', head: true })
        .gt('import_date', cutOffDate);

    console.log(`   ✅ Pedidos dentro do filtro de 60 dias: ${recentCount || 0}\n`);

    // Contar total de pedidos
    const { count: totalCount } = await supabase
        .from('spreadsheet_data')
        .select('id', { count: 'exact', head: true });

    console.log(`   📊 Total de pedidos no banco: ${totalCount || 0}\n`);

    const percentageLoaded = recentCount && totalCount ? ((recentCount / totalCount) * 100).toFixed(1) : 0;
    console.log(`   📈 Porcentagem carregada pelo filtro: ${percentageLoaded}%\n`);

    console.log('='.repeat(60) + '\n');
}

checkImportDates().catch(console.error);
