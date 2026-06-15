/**
 * SCRIPT EMERGENCIAL: Sincronizar pedidos dos dias 28 e 29 de Janeiro
 * Puxa pedidos específicos sem alterar código do site
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
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM || process.env.TINY_API_TOKEN;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF;

const COMPANIES = [
    {
        name: 'MM',
        cnpj: '39447291000104',
        token: TINY_TOKEN_MM,
        enabled: !!TINY_TOKEN_MM
    },
    {
        name: 'MVF',
        cnpj: '25116514000138',
        token: TINY_TOKEN_MVF,
        enabled: !!TINY_TOKEN_MVF
    }
];

async function syncEmergency() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🚨 SINCRONIZAÇÃO EMERGENCIAL - Dias 28 e 29 de Janeiro\n');
    console.log('='.repeat(60) + '\n');

    // Datas: 28/01/2026 e 29/01/2026
    const dates = [
        { day: '28', date: '28/01/2026' },
        { day: '29', date: '29/01/2026' }
    ];

    let totalAdded = 0;

    for (const company of COMPANIES.filter(c => c.enabled)) {
        console.log(`\n📦 Processando ${company.name}...\n`);

        for (const { day, date } of dates) {
            console.log(`   📅 Buscando pedidos de ${date}...`);

            try {
                // Buscar pedidos do dia específico
                const response = await fetch(
                    `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${company.token}&formato=JSON&dataInicial=${date}&dataFinal=${date}`
                );

                const data = await response.json();

                if (data.retorno?.status !== 'OK') {
                    console.log(`   ⚠️  Sem pedidos ou erro: ${data.retorno?.erros?.[0]?.erro || 'Desconhecido'}`);
                    continue;
                }

                const orders = data.retorno.pedidos || [];
                console.log(`   ✅ Encontrados ${orders.length} pedidos`);

                if (orders.length === 0) continue;

                // Coletar IDs dos pedidos
                const orderIds = orders.map((o: any) => String(o.pedido.id || o.pedido.numero));

                // Verificar quais já existem no banco
                const { data: existing } = await supabase
                    .from('spreadsheet_data')
                    .select('row_data')
                    .in('row_data->>ID Tiny', orderIds);

                const existingIds = new Set(existing?.map((r: any) => String(r.row_data['ID Tiny'])) || []);

                // Verificar quais já estão na fila
                const { data: inQueue } = await supabase
                    .from('webhook_retry_queue')
                    .select('order_id')
                    .in('order_id', orderIds);

                const queueIds = new Set(inQueue?.map(r => r.order_id) || []);

                // Filtrar novos pedidos
                const newOrders = orderIds.filter(id => !existingIds.has(id) && !queueIds.has(id));

                if (newOrders.length === 0) {
                    console.log(`   ℹ️  Todos os pedidos já estão no sistema`);
                    continue;
                }

                // Adicionar à fila de processamento
                const toInsert = newOrders.map(orderId => ({
                    order_id: orderId,
                    company: company.name,
                    status: 'pending',
                    retry_count: 0,
                    max_retries: 5,
                    next_retry_at: new Date().toISOString(),
                    order_date: date,
                    payload: { cnpj: company.cnpj, origin: 'Emergency Sync 28-29 Jan' }
                }));

                const { error } = await supabase
                    .from('webhook_retry_queue')
                    .insert(toInsert);

                if (error) {
                    console.error(`   ❌ Erro ao adicionar à fila:`, error);
                } else {
                    totalAdded += toInsert.length;
                    console.log(`   ✅ Adicionados ${toInsert.length} novos pedidos à fila`);
                }

            } catch (error: any) {
                console.error(`   ❌ Erro ao buscar pedidos de ${date}:`, error.message);
            }

            // Delay entre requests
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎯 RESUMO:\n`);
    console.log(`   ✅ Total de pedidos novos adicionados: ${totalAdded}`);

    if (totalAdded > 0) {
        console.log(`\n💡 PRÓXIMO PASSO:`);
        console.log(`   Execute o processamento da fila para importar os pedidos:`);
        console.log(`   \n   npx tsx scripts/process-queue-manual.ts\n`);
    } else {
        console.log(`\n   ℹ️  Nenhum pedido novo encontrado (todos já estão no sistema)\n`);
    }
}

syncEmergency().catch(console.error);
