
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env: any = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('spreadsheet_data')
        .select('id, row_data')
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`\n🔍 Amostra de Pedidos (${data.length} encontrados):\n`);
    data.forEach(item => {
        const row = item.row_data;
        console.log(`   - ID: ${row['Número da ordem de compra'] || row['id']}`);
        console.log(`     Situação: ${row['Situação'] || row['situacao']}`);
        console.log(`     Data: ${row['Data'] || row['data']}`);
        console.log(`     Canal: ${row['Canal'] || row['canal']}`);
        console.log(`     CNPJ: ${row['CNPJ'] || row['cnpj']}`);
        console.log(`     ---`);
    });

    const { data: statusCounts } = await supabase.rpc('get_status_counts_v2'); // If exists
    // Fallback: manual count
    const { data: allRows } = await supabase.from('spreadsheet_data').select('row_data');
    const counts: any = {};
    allRows?.forEach(r => {
        const s = r.row_data?.['Situação'] || r.row_data?.situacao || 'SEM STATUS';
        counts[s] = (counts[s] || 0) + 1;
    });

    console.log('\n📈 Resumo de Status:');
    console.log(JSON.stringify(counts, null, 2));
}

check();
