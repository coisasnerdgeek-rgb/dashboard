/**
 * Corrigir campo "Loja" dos pedidos dos dias 27, 28 e 29
 * Usa a lógica do inferStore para identificar a loja correta
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

// Função copiada do process-retry-queue.ts
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

async function fixStoreNames() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔧 Corrigindo Campo "Loja" dos Pedidos Recentes\n');
    console.log('='.repeat(60) + '\n');

    const dates = ['27/01/2026', '28/01/2026', '29/01/2026'];

    let totalFixed = 0;
    let totalSkipped = 0;

    for (const date of dates) {
        console.log(`📅 Processando pedidos de ${date}...`);

        // Buscar todos os pedidos do dia
        const { data: orders, error } = await supabase
            .from('spreadsheet_data')
            .select('id, row_data')
            .eq('row_data->>Data', date);

        if (error) {
            console.error(`   ❌ Erro:`, error);
            continue;
        }

        if (!orders || orders.length === 0) {
            console.log(`   ⚠️  Nenhum pedido encontrado\n`);
            continue;
        }

        console.log(`   Encontrados ${orders.length} pedidos\n`);

        let fixed = 0;
        let skipped = 0;

        for (const order of orders) {
            const rowData = order.row_data;
            const ecommerceId = rowData['Ecommerce ID'];
            const currentLoja = rowData['Loja'];

            // Determinar CNPJ baseado na loja atual ou observações
            let cnpj = 'MVF'; // default
            if (currentLoja?.includes('MM') || rowData['Observações Internas']?.includes('39447291')) {
                cnpj = 'MM';
            }

            // Inferir loja correta
            const correctLoja = inferStore(ecommerceId, cnpj);

            // Verificar se precisa correção
            if (currentLoja === correctLoja) {
                skipped++;
                continue;
            }

            // Atualizar no banco
            const updatedRowData = {
                ...rowData,
                'Loja': correctLoja
            };

            const { error: updateError } = await supabase
                .from('spreadsheet_data')
                .update({ row_data: updatedRowData })
                .eq('id', order.id);

            if (updateError) {
                console.log(`      ❌ Erro ao atualizar #${rowData['ID Tiny']}: ${updateError.message}`);
            } else {
                fixed++;
                totalFixed++;
                if (fixed <= 5) {
                    console.log(`      ✅ #${rowData['ID Tiny']}: "${currentLoja}" → "${correctLoja}"`);
                }
            }
        }

        if (fixed > 5) {
            console.log(`      ... e mais ${fixed - 5} pedidos corrigidos`);
        }

        console.log(`   ✅ Corrigidos: ${fixed} | Já corretos: ${skipped}\n`);
        totalSkipped += skipped;
    }

    console.log('='.repeat(60));
    console.log('\n🎯 RESUMO:\n');
    console.log(`   ✅ Total corrigido: ${totalFixed}`);
    console.log(`   ⏭️  Já estavam corretos: ${totalSkipped}`);
    console.log(`\n✅ Correção concluída! Atualize o site para ver as mudanças.\n`);
}

fixStoreNames().catch(console.error);
