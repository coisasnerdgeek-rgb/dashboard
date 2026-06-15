/**
 * Corrigir Ecommerce IDs dos pedidos dos dias 27-29
 * Busca do Tiny e atualiza o campo correto
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

// Função inferStore copiada
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

async function fixEcommerceIds() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔧 Corrigindo Ecommerce IDs e Lojas\n');
    console.log('='.repeat(60) + '\n');

    const dates = ['27/01/2026', '28/01/2026', '29/01/2026'];

    let totalFixed = 0;
    let rateLimitHits = 0;

    for (const date of dates) {
        console.log(`📅 Processando ${date}...`);

        // Buscar pedidos com Ecommerce ID vazio ou "undefined"
        const { data: orders } = await supabase
            .from('spreadsheet_data')
            .select('id, row_data')
            .eq('row_data->>Data', date)
            .or('row_data->>Ecommerce ID.eq.,row_data->>Ecommerce ID.eq.undefined');

        if (!orders || orders.length === 0) {
            console.log(`   ✅ Nenhum pedido a corrigir\n`);
            continue;
        }

        console.log(`   Encontrados ${orders.length} pedidos a corrigir\n`);

        // Agrupar por Tiny ID para evitar buscas duplicadas
        const uniqueTinyIds = new Set(orders.map(o => o.row_data['ID Tiny']));

        let fixed = 0;

        for (const tinyId of uniqueTinyIds) {
            // Determinar token baseado no CNPJ (assumir MM se não souber)
            const firstOrder = orders.find(o => o.row_data['ID Tiny'] === tinyId);
            let token = TINY_TOKEN_MM;
            if (firstOrder?.row_data['Observações Internas']?.includes('25116514')) {
                token = TINY_TOKEN_MVF;
            }

            try {
                // Buscar do Tiny
                const response = await fetch(
                    `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${tinyId}&formato=JSON`
                );
                const data = await response.json();

                if (data.retorno?.status !== 'OK') {
                    const erro = data.retorno?.erros?.[0]?.erro || '';
                    if (erro.includes('bloqueada') || erro.includes('Excedido')) {
                        console.log(`   ⏸️  RATE LIMIT - Aguardando 60s...`);
                        rateLimitHits++;
                        await new Promise(r => setTimeout(r, 60000));
                        // Tentar novamente
                        continue;
                    }
                    console.log(`   ⚠️  Erro #${tinyId}: ${erro.substring(0, 50)}`);
                    continue;
                }

                const pedido = data.retorno.pedido;

                // Extrair Ecommerce ID correto
                const ecommerceId = pedido.numero_pedido_ecommerce ||
                    pedido.numero_ecommerce ||
                    pedido.ecommerce?.numero_ecommerce ||
                    '';

                if (!ecommerceId) {
                    console.log(`   ⚠️  #${tinyId}: Sem Ecommerce ID no Tiny`);
                    continue;
                }

                // Determinar CNPJ
                const cnpj = token === TINY_TOKEN_MM ? 'MM' : 'MVF';

                // Inferir loja correta
                const correctLoja = inferStore(ecommerceId, cnpj);

                // Atualizar TODOS os registros desse pedido
                const ordersToUpdate = orders.filter(o => o.row_data['ID Tiny'] === tinyId);

                for (const order of ordersToUpdate) {
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

                if (fixed <= 5) {
                    console.log(`   ✅ #${tinyId}: Ecommerce "${ecommerceId}" → Loja "${correctLoja}"`);
                }

                // Delay anti-rate-limit
                await new Promise(r => setTimeout(r, 350));

            } catch (error: any) {
                console.error(`   ❌ Erro #${tinyId}:`, error.message);
            }
        }

        if (fixed > 5) {
            console.log(`   ... e mais ${fixed - 5} pedidos corrigidos`);
        }

        console.log(`   ✅ Total corrigido: ${fixed}\n`);
    }

    console.log('='.repeat(60));
    console.log('\n🎯 RESUMO:\n');
    console.log(`   ✅ Pedidos corrigidos: ${totalFixed}`);
    console.log(`   ⏸️  Rate limits: ${rateLimitHits}`);
    console.log(`\n✅ Correção concluída! Atualize o site.\n`);
}

fixEcommerceIds().catch(console.error);
