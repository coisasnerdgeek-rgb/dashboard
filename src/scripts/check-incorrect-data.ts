/**
 * Verificar quantos pedidos ainda têm dados incorretos
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

async function checkIncorrectData() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔍 Verificando Pedidos com Dados Incorretos\n');
    console.log('='.repeat(60) + '\n');

    const dates = ['27/01/2026', '28/01/2026', '29/01/2026'];

    for (const date of dates) {
        console.log(`📅 Data: ${date}\n`);

        // Pedidos com loja BUSINESS
        const { count: businessCount } = await supabase
            .from('spreadsheet_data')
            .select('id', { count: 'exact', head: true })
            .eq('row_data->>Data', date)
            .eq('row_data->>Loja', 'BUSINESS');

        // Pedidos com Cliente undefined
        const { count: undefinedClientCount } = await supabase
            .from('spreadsheet_data')
            .select('id', { count: 'exact', head: true })
            .eq('row_data->>Data', date)
            .eq('row_data->>Cliente', 'undefined');

        // Pedidos com Ecommerce ID vazio/undefined
        const { count: emptyEcommerceCount } = await supabase
            .from('spreadsheet_data')
            .select('id', { count: 'exact', head: true })
            .eq('row_data->>Data', date)
            .or('row_data->>Ecommerce ID.eq.,row_data->>Ecommerce ID.eq.undefined');

        console.log(`   Loja = BUSINESS: ${businessCount || 0}`);
        console.log(`   Cliente = undefined: ${undefinedClientCount || 0}`);
        console.log(`   Ecommerce ID vazio: ${emptyEcommerceCount || 0}\n`);

        // Mostrar amostra dos pedidos com problema
        if (businessCount && businessCount > 0) {
            const { data: samples } = await supabase
                .from('spreadsheet_data')
                .select('row_data')
                .eq('row_data->>Data', date)
                .eq('row_data->>Loja', 'BUSINESS')
                .limit(3);

            if (samples && samples.length > 0) {
                console.log(`   📦 Amostras com BUSINESS:\n`);
                samples.forEach((s: any) => {
                    console.log(`      ID Tiny: ${s.row_data['ID Tiny']}`);
                    console.log(`      Ecommerce ID: "${s.row_data['Ecommerce ID']}"`);
                    console.log(`      Cliente: "${s.row_data['Cliente']}"`);
                    console.log(`      SKU: ${s.row_data['SKU']}`);
                    console.log('');
                });
            }
        }
    }

    console.log('='.repeat(60) + '\n');
}

checkIncorrectData().catch(console.error);
