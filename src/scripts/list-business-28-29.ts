/**
 * Verificar TODOS os pedidos BUSINESS dos dias 28-29 com detalhes
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

async function listAllBusiness() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n📋 Lista Completa de Pedidos BUSINESS (Dias 28-29)\n');
    console.log('='.repeat(60) + '\n');

    for (const date of ['28/01/2026', '29/01/2026']) {
        const { data, count } = await supabase
            .from('spreadsheet_data')
            .select('row_data, filename', { count: 'exact' })
            .eq('row_data->>Data', date)
            .eq('row_data->>Loja', 'BUSINESS');

        console.log(`\n📅 Dia ${date.substring(0, 5)}: ${count || 0} pedidos\n`);

        if (data && data.length > 0) {
            const grouped: Record<string, any> = {};

            data.forEach((item: any) => {
                const tinyId = item.row_data['ID Tiny'];
                if (!grouped[tinyId]) {
                    grouped[tinyId] = {
                        cliente: item.row_data['Cliente'],
                        ecommId: item.row_data['Ecommerce ID'],
                        filename: item.filename,
                        count: 0
                    };
                }
                grouped[tinyId].count++;
            });

            Object.entries(grouped).forEach(([tinyId, info]: [string, any]) => {
                console.log(`   ID Tiny: ${tinyId} (${info.count}x itens)`);
                console.log(`      Ecomm ID: "${info.ecommId}"`);
                console.log(`      Cliente: "${info.cliente}"`);
                console.log(`      Filename: "${info.filename}"`);
                console.log('');
            });
        }
    }

    console.log('='.repeat(60) + '\n');
}

listAllBusiness().catch(console.error);
