/**
 * Processar APENAS pedidos dos dias 28-29 da fila de retry
 * Ignora os 34k pedidos antigos acumulados
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

async function processOnlyRecent() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🎯 Processando APENAS Pedidos dos Dias 28-29\n');
    console.log('='.repeat(60) + '\n');

    const dates = ['28/01/2026', '29/01/2026'];

    // Buscar APENAS pedidos dos dias 28-29 que estão pendentes
    const { data: targetOrders, error } = await supabase
        .from('webhook_retry_queue')
        .select('*')
        .in('order_date', dates)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Erro ao buscar fila:', error);
        return;
    }

    if (!targetOrders || targetOrders.length === 0) {
        console.log('✅ Nenhum pedido dos dias 28-29 pendente na fila!\n');
        console.log('💡 Provavelmente já foram todos processados.\n');
        return;
    }

    console.log(`📊 Encontrados ${targetOrders.length} pedidos dos dias 28-29 para processar:\n`);

    const byCompany = targetOrders.reduce((acc: any, order: any) => {
        acc[order.company] = (acc[order.company] || 0) + 1;
        return acc;
    }, {});

    Object.entries(byCompany).forEach(([company, count]) => {
        console.log(`   ${company}: ${count} pedidos`);
    });

    console.log('\n' + '-'.repeat(60) + '\n');

    let processed = 0;
    let failed = 0;
    let rateLimitHits = 0;

    for (const queueItem of targetOrders) {
        const orderId = queueItem.order_id;
        const company = queueItem.company;
        const token = company === 'MM' ? TINY_TOKEN_MM : TINY_TOKEN_MVF;

        console.log(`[${processed + failed + 1}/${targetOrders.length}] Processando #${orderId} (${company})...`);

        try {
            // Verificar se já existe no banco
            const { data: existing } = await supabase
                .from('spreadsheet_data')
                .select('id')
                .eq('row_data->>ID Tiny', orderId)
                .limit(1);

            if (existing && existing.length > 0) {
                console.log(`   ⏭️  Já existe no banco - marcando como completed`);

                await supabase
                    .from('webhook_retry_queue')
                    .update({ status: 'completed' })
                    .eq('id', queueItem.id);

                processed++;
                continue;
            }

            // Buscar do Tiny
            const response = await fetch(
                `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${orderId}&formato=JSON`
            );

            const data = await response.json();

            if (data.retorno?.status !== 'OK') {
                const erro = data.retorno?.erros?.[0]?.erro || 'Erro desconhecido';

                if (erro.includes('bloqueada') || erro.includes('Excedido')) {
                    console.log(`   ⏸️  RATE LIMIT - Aguardando 60s...`);
                    rateLimitHits++;
                    await new Promise(r => setTimeout(r, 60000));
                    // Não incrementar contador - vai tentar de novo
                    continue;
                }

                console.log(`   ❌ Erro: ${erro.substring(0, 50)}...`);

                await supabase
                    .from('webhook_retry_queue')
                    .update({
                        status: 'failed',
                        last_error: erro,
                        retry_count: queueItem.retry_count + 1
                    })
                    .eq('id', queueItem.id);

                failed++;
                await new Promise(r => setTimeout(r, 500));
                continue;
            }

            const pedido = data.retorno.pedido;
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [pedido.itens];

            // Inserir no banco
            for (const itemWrapper of itens) {
                const item = itemWrapper.item;

                const rowData = {
                    "ID Tiny": orderId,
                    "Ecommerce ID": pedido.ecommerce?.numero_ecommerce || '',
                    "Data": pedido.data_pedido || '',
                    "Cliente": pedido.cliente?.nome || '',
                    "SKU": item.codigo || '',
                    "Produto": item.descricao || '',
                    "Quantidade": item.quantidade || '',
                    "Observações": pedido.obs || '',
                    "Observações Internas": pedido.obs_interna || '',
                    "Situação": pedido.situacao || '',
                    "Loja": `${pedido.nome_vendedor || ''} ${company}`.trim(),
                    "Valor Unitário": item.valor_unitario || '',
                    "Valor Total": pedido.valor_pedido || ''
                };

                await supabase
                    .from('spreadsheet_data')
                    .insert({
                        filename: `Tiny ${company} - Emergency Sync`,
                        import_date: new Date().toISOString(),
                        row_data: rowData
                    });
            }

            // Marcar como completado
            await supabase
                .from('webhook_retry_queue')
                .update({ status: 'completed' })
                .eq('id', queueItem.id);

            console.log(`   ✅ Importado com sucesso (${itens.length} itens)`);
            processed++;

            // Delay anti-rate-limit
            await new Promise(r => setTimeout(r, 400));

        } catch (error: any) {
            console.error(`   ❌ Erro ao processar:`, error.message);
            failed++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎯 RESUMO:\n`);
    console.log(`   ✅ Processados: ${processed}`);
    console.log(`   ❌ Falhados: ${failed}`);
    console.log(`   ⏸️  Rate limits encontrados: ${rateLimitHits}`);
    console.log(`\n✅ Concluído! Atualize o site para ver os pedidos.\n`);
}

processOnlyRecent().catch(console.error);
