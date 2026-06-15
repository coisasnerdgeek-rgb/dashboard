/**
 * Corrigir manualmente os 2 últimos pedidos BUSINESS do dia 28
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

async function fixLast2Orders() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔧 Corrigindo Os 2 Últimos Pedidos BUSINESS\n');
    console.log('='.repeat(60) + '\n');

    const targetOrders = ['946108110', '946108114'];

    for (const tinyId of targetOrders) {
        console.log(`📦 Processando #${tinyId}...`);

        // Tentar com ambos os tokens
        for (const [company, token] of [['MVF', TINY_TOKEN_MVF], ['MM', TINY_TOKEN_MM]] as const) {
            try {
                const response = await fetch(
                    `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${tinyId}&formato=JSON`
                );
                const data = await response.json();

                if (data.retorno?.status === 'OK') {
                    console.log(`   ✅ Encontrado na empresa ${company}`);

                    const pedido = data.retorno.pedido;
                    const itens = Array.isArray(pedido.itens) ? pedido.itens : [pedido.itens];
                    const item = itens[0].item;

                    const ecommerceId = pedido.numero_pedido_ecommerce || pedido.numero_ecommerce || pedido.ecommerce?.numero_ecommerce || '';
                    const cliente = pedido.cliente?.nome || '';
                    const correctLoja = inferStore(ecommerceId, company);

                    console.log(`      Ecommerce ID: ${ecommerceId}`);
                    console.log(`      Cliente: ${cliente}`);
                    console.log(`      Loja: ${correctLoja}`);

                    // Buscar registro no banco
                    const { data: records } = await supabase
                        .from('spreadsheet_data')
                        .select('id, row_data')
                        .eq('row_data->>ID Tiny', tinyId);

                    if (records && records.length > 0) {
                        for (const record of records) {
                            const updatedRowData = {
                                ...record.row_data,
                                'Ecommerce ID': ecommerceId,
                                'Cliente': cliente,
                                'Loja': correctLoja,
                                'Produto': item.descricao || record.row_data['Produto'],
                                'SKU': item.codigo || record.row_data['SKU'],
                                'Quantidade': item.quantidade || record.row_data['Quantidade'],
                                'Observações': pedido.obs || '',
                                'Observações Internas': pedido.obs_interna || '',
                                'Situação': pedido.situacao || record.row_data['Situação']
                            };

                            await supabase
                                .from('spreadsheet_data')
                                .update({ row_data: updatedRowData })
                                .eq('id', record.id);
                        }

                        console.log(`      ✅ Atualizado no banco (${records.length} registros)\n`);
                    }

                    break; // Encontrou, não precisa tentar outro token
                }
            } catch (error: any) {
                console.error(`      ⚠️  Erro com ${company}:`, error.message);
            }

            await new Promise(r => setTimeout(r, 500));
        }
    }

    console.log('='.repeat(60));
    console.log('\n✅ Concluído! Atualize o site.\n');
}

fixLast2Orders().catch(console.error);
