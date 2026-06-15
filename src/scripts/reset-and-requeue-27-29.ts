/**
 * RESET E RE-ENFILEIRAR PEDIDOS DOS DIAS 27-29
 * 
 * 1. Deleta pedidos incorretos do spreadsheet_data
 * 2. Adiciona na fila de retry para reprocessamento correto
 * 3. Depois, clique em "Atualizar Status" no site
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

async function resetAndRequeue() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔄 RESET E RE-ENFILEIRAMENTO DOS DIAS 27-29\n');
    console.log('='.repeat(60) + '\n');

    const dates = ['27/01/2026', '28/01/2026', '29/01/2026'];
    const tinyIdsToRequeue = new Set<string>();

    // PASSO 1: Coletar IDs Tiny dos pedidos a deletar
    console.log('📋 PASSO 1: Identificando pedidos a resetar...\n');

    for (const date of dates) {
        const { data: orders } = await supabase
            .from('spreadsheet_data')
            .select('row_data')
            .eq('row_data->>Data', date);

        if (orders && orders.length > 0) {
            console.log(`   ${date}: ${orders.length} registros encontrados`);

            orders.forEach((order: any) => {
                const tinyId = order.row_data['ID Tiny'];
                if (tinyId) {
                    tinyIdsToRequeue.add(String(tinyId));
                }
            });
        } else {
            console.log(`   ${date}: Nenhum registro encontrado`);
        }
    }

    const uniqueOrders = Array.from(tinyIdsToRequeue);
    console.log(`\n   ✅ Total de pedidos únicos: ${uniqueOrders.length}\n`);

    if (uniqueOrders.length === 0) {
        console.log('❌ Nenhum pedido encontrado para processar!\n');
        return;
    }

    // PASSO 2: Deletar registros do spreadsheet_data
    console.log('🗑️  PASSO 2: Deletando registros antigos...\n');

    for (const date of dates) {
        const { error, count } = await supabase
            .from('spreadsheet_data')
            .delete({ count: 'exact' })
            .eq('row_data->>Data', date);

        if (error) {
            console.error(`   ❌ Erro ao deletar ${date}:`, error.message);
        } else {
            console.log(`   ✅ ${date}: ${count || 0} registros deletados`);
        }
    }

    // PASSO 3: Adicionar na fila de retry
    console.log('\n📥 PASSO 3: Adicionando na fila de retry...\n');

    let added = 0;
    let skipped = 0;

    for (const tinyId of uniqueOrders) {
        // Verificar se já existe na fila
        const { data: existing } = await supabase
            .from('webhook_retry_queue')
            .select('id')
            .eq('order_id', tinyId)
            .maybeSingle();

        if (existing) {
            // Já existe, atualizar status para pending
            await supabase
                .from('webhook_retry_queue')
                .update({
                    status: 'pending',
                    retry_count: 0,
                    last_error: null,
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', tinyId);

            skipped++;
        } else {
            // Adicionar novo
            const { error } = await supabase
                .from('webhook_retry_queue')
                .insert({
                    order_id: tinyId,
                    status: 'pending',
                    retry_count: 0,
                    order_date: null, // Será preenchido ao processar
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error(`   ⚠️  Erro ao adicionar #${tinyId}:`, error.message);
            } else {
                added++;
            }
        }

        // Progress
        if ((added + skipped) % 50 === 0) {
            console.log(`   Progresso: ${added + skipped}/${uniqueOrders.length}`);
        }
    }

    console.log(`\n   ✅ Novos: ${added}`);
    console.log(`   ♻️  Atualizados: ${skipped}`);
    console.log(`   📊 Total na fila: ${added + skipped}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ CONCLUÍDO!\n');
    console.log('📋 PRÓXIMOS PASSOS:\n');
    console.log('   1. Acesse o site: https://dashboard-pedidos.vercel.app');
    console.log('   2. Clique no botão "Atualizar Status" (ou "Processar Fila")');
    console.log('   3. Aguarde o processamento (pode demorar alguns minutos)');
    console.log('   4. Atualize a página (Ctrl + F5) para ver os pedidos corretos\n');
}

resetAndRequeue().catch(console.error);
