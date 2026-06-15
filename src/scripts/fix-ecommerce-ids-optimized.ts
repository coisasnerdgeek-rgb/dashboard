/**
 * VERSÃO OTIMIZADA - Corrigir Ecommerce IDs com identificação correta de empresa
 * Primeiro identifica se é MM ou MVF, depois busca com token correto
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

const inferStore = (orderId: string | number | undefined, fileCnpj?: string): string => {
    const id = String(orderId ?? '').trim();
    if (!id) return 'BUSINESS';

    const isShopee = ['26', '2510', 'ID2', '25091', '25010', '25011', '2509', '2501', '2502', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260'].some(prefix => id.startsWith(prefix));
    if (isShopee) {
        if (fileCnpj === 'MM' || fileCnpj?.includes('39447291')) return 'SH MM';
        return 'SH VEST';
    }

    let lojaBase: string;
    if (id.startsWith('2000') || id.startsWith('2,000') || id.startsWith('0200') || id.startsWith('MLB')) {
        lojaBase = 'ML VEST';
    } else if (id.startsWith('LU-')) {
        lojaBase = 'MG VEST';
    } else if (id.startsWith('14')) {
        lojaBase = 'NT VEST';
    } else if (id.startsWith('GSH')) {
        lojaBase = 'SN VEST';
    } else if (id.match(/^\d{3}-\d{7}-\d{7}$/) || id.startsWith('701') || id.startsWith('702')) {
        lojaBase = 'AM VEST';
    } else if (id.startsWith('12')) {
        lojaBase = 'KW VEST';
    } else {
        lojaBase = 'BUSINESS';
    }

    if ((fileCnpj === 'MM' || fileCnpj?.includes('39447291')) && lojaBase !== 'BUSINESS') {
        return lojaBase.replace('VEST', 'MM');
    }

    return lojaBase;
};

async function fixEcommerceIdsOptimized() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🚀 VERSÃO OTIMIZADA - Corrigindo Ecommerce IDs\n');
    console.log('='.repeat(60) + '\n');

    const dates = ['27/01/2026', '28/01/2026', '29/01/2026'];

    let totalFixed = 0;

    for (const date of dates) {
        console.log(`📅 Processando ${date}...\n`);

        // Buscar pedidos com Ecommerce ID vazio/undefined
        const { data: orders } = await supabase
            .from('spreadsheet_data')
            .select('id, row_data, filename')
            .eq('row_data->>Data', date)
            .or('row_data->>Ecommerce ID.eq.,row_data->>Ecommerce ID.eq.undefined');

        if (!orders || orders.length === 0) {
            console.log(`   ✅ Nenhum pedido a corrigir\n`);
            continue;
        }

        // Agrupar por Tiny ID e empresa
        const ordersByTinyId: Record<string, { orders: any[], company: 'MM' | 'MVF' }> = {};

        for (const order of orders) {
            const tinyId = order.row_data['ID Tiny'];

            if (!ordersByTinyId[tinyId]) {
                // Detectar empresa pelo filename ou outros indicadores
                let company: 'MM' | 'MVF' = 'MM'; // default

                if (order.filename?.includes('MVF') || order.filename?.includes('VEST')) {
                    company = 'MVF';
                } else if (order.filename?.includes('MM')) {
                    company = 'MM';
                }

                ordersByTinyId[tinyId] = { orders: [], company };
            }

            ordersByTinyId[tinyId].orders.push(order);
        }

        console.log(`   Encontrados ${Object.keys(ordersByTinyId).length} pedidos únicos a corrigir`);
        console.log(`   Total de registros: ${orders.length}\n`);

        // Processar por empresa em lotes
        const companies = ['MM', 'MVF'] as const;

        for (const company of companies) {
            const companyOrders = Object.entries(ordersByTinyId).filter(([_, data]) => data.company === company);

            if (companyOrders.length === 0) continue;

            console.log(`\n   📦 Processando ${companyOrders.length} pedidos da empresa ${company}...\n`);

            const token = company === 'MM' ? TINY_TOKEN_MM : TINY_TOKEN_MVF;
            let fixed = 0;
            let notFound = 0;

            for (const [tinyId, { orders: ordersGroup }] of companyOrders) {
                try {
                    // Buscar do Tiny
                    const response = await fetch(
                        `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${tinyId}&formato=JSON`
                    );
                    const data = await response.json();

                    if (data.retorno?.status !== 'OK') {
                        const erro = data.retorno?.erros?.[0]?.erro || '';
                        if (erro.includes('bloqueada') || erro.includes('Excedido')) {
                            console.log(`      ⏸️  Rate limit - Aguardando 90s...`);
                            await new Promise(r => setTimeout(r, 90000));
                            continue; // vai tentar de novo na próxima iteração
                        }
                        notFound++;
                        continue;
                    }

                    const pedido = data.retorno.pedido;

                    // Extrair Ecommerce ID
                    const ecommerceId = pedido.numero_pedido_ecommerce ||
                        pedido.numero_ecommerce ||
                        pedido.ecommerce?.numero_ecommerce ||
                        '';

                    if (!ecommerceId) {
                        notFound++;
                        continue;
                    }

                    // Inferir loja
                    const correctLoja = inferStore(ecommerceId, company);

                    // Atualizar todos os registros
                    for (const order of ordersGroup) {
                        const updatedRowData = {
                            ...order.row_data,
                            'Ecommerce ID': ecommerceId,
                            'Loja': correctLoja
                        };

                        await supabase
                            .from('spreadsheet_data')
                            .update({ row_data: updatedRowData })
                            .eq('id', order.id);
                    }

                    fixed++;
                    totalFixed++;

                    if (fixed <= 3 || fixed % 10 === 0) {
                        console.log(`      ✅ #${tinyId}: "${ecommerceId}" → ${correctLoja}`);
                    }

                    // Delay anti-rate-limit
                    await new Promise(r => setTimeout(r, 400));

                } catch (error: any) {
                    console.error(`      ❌ #${tinyId}: ${error.message}`);
                }
            }

            console.log(`\n      ✨ ${company}: ${fixed} corrigidos${notFound > 0 ? `, ${notFound} não encontrados` : ''}`);
        }

        console.log('');
    }

    console.log('='.repeat(60));
    console.log('\n🎯 RESUMO FINAL:\n');
    console.log(`   ✅ Total corrigido: ${totalFixed}`);
    console.log(`\n✅ Concluído! Atualize o site para ver as lojas corretas.\n`);
}

fixEcommerceIdsOptimized().catch(console.error);
