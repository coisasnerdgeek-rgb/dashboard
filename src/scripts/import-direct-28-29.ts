/**
 * SOLUÇÃO EMERGENCIAL: Processar pedidos dos dias 28-29 DIRETO do Tiny
 * Bypassa a fila e importa diretamente para spreadsheet_data
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
    { name: 'MM', cnpj: '39447291000104', token: TINY_TOKEN_MM, enabled: !!TINY_TOKEN_MM },
    { name: 'MVF', cnpj: '25116514000138', token: TINY_TOKEN_MVF, enabled: !!TINY_TOKEN_MVF }
];

async function importDirectFromTiny() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🚀 IMPORTAÇÃO DIRETA DO TINY - Dias 28 e 29\n');
    console.log('='.repeat(60) + '\n');

    const dates = [
        { day: '28', date: '28/01/2026' },
        { day: '29', date: '29/01/2026' }
    ];

    let totalImported = 0;
    let totalSkipped = 0;

    for (const company of COMPANIES.filter(c => c.enabled)) {
        console.log(`\n📦 Processando ${company.name}...\n`);

        for (const { day, date } of dates) {
            console.log(`   📅 Importando pedidos de ${date}...`);

            try {
                // Buscar IDs dos pedidos do dia
                const listResponse = await fetch(
                    `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${company.token}&formato=JSON&dataInicial=${date}&dataFinal=${date}`
                );
                const listData = await listResponse.json();

                if (listData.retorno?.status !== 'OK') {
                    console.log(`   ⚠️  ${listData.retorno?.erros?.[0]?.erro || 'Sem pedidos'}`);
                    continue;
                }

                const orders = listData.retorno.pedidos || [];
                console.log(`   ✅ Encontrados ${orders.length} pedidos`);

                if (orders.length === 0) continue;

                // Processar cada pedido
                let imported = 0;
                let skipped = 0;

                for (const orderSummary of orders) {
                    const orderId = String(orderSummary.pedido.id || orderSummary.pedido.numero);

                    // Verificar se já existe
                    const { data: existing } = await supabase
                        .from('spreadsheet_data')
                        .select('id')
                        .eq('row_data->>ID Tiny', orderId)
                        .single();

                    if (existing) {
                        skipped++;
                        continue;
                    }

                    // Buscar detalhes completos do pedido
                    const detailResponse = await fetch(
                        `https://api.tiny.com.br/api2/pedido.obter.php?token=${company.token}&id=${orderId}&formato=JSON`
                    );
                    const detailData = await detailResponse.json();

                    if (detailData.retorno?.status !== 'OK') {
                        console.log(`      ⚠️  Erro ao buscar #${orderId}: ${detailData.retorno?.erros?.[0]?.erro}`);
                        await new Promise(r => setTimeout(r, 500));
                        continue;
                    }

                    const pedido = detailData.retorno.pedido;

                    // Processar cada item do pedido
                    const itens = Array.isArray(pedido.itens) ? pedido.itens : [pedido.itens];

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
                            "Loja": `${pedido.nome_vendedor || ''} ${company.name}`.trim(),
                            "Valor Unitário": item.valor_unitario || '',
                            "Valor Total": pedido.valor_pedido || ''
                        };

                        // Inserir no banco
                        const { error } = await supabase
                            .from('spreadsheet_data')
                            .insert({
                                filename: `Tiny ${company.name} - ${date}`,
                                import_date: new Date().toISOString(),
                                row_data: rowData
                            });

                        if (error) {
                            console.log(`      ❌ Erro ao inserir #${orderId}: ${error.message}`);
                        } else {
                            imported++;
                            totalImported++;
                        }
                    }

                    // Delay anti-rate-limit
                    await new Promise(r => setTimeout(r, 300));
                }

                console.log(`   ✅ Importados: ${imported} | Já existiam: ${skipped}`);
                totalSkipped += skipped;

            } catch (error: any) {
                console.error(`   ❌ Erro:`, error.message);
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎯 RESUMO:\n`);
    console.log(`   ✅ Total importados: ${totalImported}`);
    console.log(`   ⏭️  Total pulados (já existentes): ${totalSkipped}`);
    console.log(`\n✅ Importação concluída! Atualize o site para ver os pedidos.\n`);
}

importDirectFromTiny().catch(console.error);
