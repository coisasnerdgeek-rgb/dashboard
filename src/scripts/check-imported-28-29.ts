/**
 * Verificar se pedidos dos dias 28 e 29 foram importados
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

async function checkImportedOrders() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔍 Verificando Pedidos Importados dos Dias 28 e 29\n');
    console.log('='.repeat(60) + '\n');

    // Verificar pedidos com data 28/01/2026 ou 29/01/2026
    const dates = ['28/01/2026', '29/01/2026'];

    for (const date of dates) {
        console.log(`📅 Verificando pedidos de ${date}...\n`);

        const { data, error, count } = await supabase
            .from('spreadsheet_data')
            .select('row_data', { count: 'exact' })
            .eq('row_data->>Data', date)
            .order('import_date', { ascending: false })
            .limit(10);

        if (error) {
            console.error(`❌ Erro:`, error);
            continue;
        }

        console.log(`   Total no banco: ${count || 0} pedidos`);

        if (data && data.length > 0) {
            console.log(`\n   Últimos 5 importados:`);
            data.slice(0, 5).forEach((row: any, idx: number) => {
                console.log(`   ${idx + 1}. ID: ${row.row_data['ID Tiny']} | SKU: ${row.row_data['SKU']} | Status: ${row.row_data['Situação']}`);
            });
        } else {
            console.log(`   ⚠️  Nenhum pedido encontrado com esta data no banco!`);
        }

        console.log('');
    }

    // Verificar fila de retry
    console.log('\n⏳ Verificando Fila de Retry...\n');

    const { data: queueData } = await supabase
        .from('webhook_retry_queue')
        .select('*')
        .in('order_date', dates);

    if (queueData && queueData.length > 0) {
        const byStatus = queueData.reduce((acc: any, item: any) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
        }, {});

        console.log(`   Total na fila de retry: ${queueData.length}`);
        Object.entries(byStatus).forEach(([status, count]) => {
            const emoji = status === 'pending' ? '⏳' : status === 'completed' ? '✅' : '❌';
            console.log(`   ${emoji} ${status}: ${count}`);
        });

        // Mostrar alguns pedidos pendentes
        const pending = queueData.filter(i => i.status === 'pending');
        if (pending.length > 0) {
            console.log(`\n   Pedidos ainda pendentes (primeiros 5):`);
            pending.slice(0, 5).forEach((item: any, idx: number) => {
                console.log(`   ${idx + 1}. Order ID: ${item.order_id} | Empresa: ${item.company} | Tentativas: ${item.retry_count}`);
            });
        }

        // Mostrar falhas se houver
        const failed = queueData.filter(i => i.status === 'failed');
        if (failed.length > 0) {
            console.log(`\n   ⚠️  Pedidos falhados (primeiros 3):`);
            failed.slice(0, 3).forEach((item: any, idx: number) => {
                console.log(`   ${idx + 1}. Order ID: ${item.order_id} | Erro: ${item.last_error?.substring(0, 50)}...`);
            });
        }
    } else {
        console.log(`   ✅ Nenhum pedido dos dias 28-29 encontrado na fila`);
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

checkImportedOrders().catch(console.error);
