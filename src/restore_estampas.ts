import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');

// Manual env parsing
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
    }
});

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function isUUID(str: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

async function restoreEstampas() {
    console.log('🚀 Iniciando restauração filtrada de Estamparia...');

    try {
        const { data: deletedOrders, error: fetchError } = await supabase
            .from('deleted_orders')
            .select('order_id');

        if (fetchError) throw fetchError;
        if (!deletedOrders || deletedOrders.length === 0) {
            console.log('✅ Nenhum pedido encontrado na lista de excluídos.');
            return;
        }

        const allOrderIds = deletedOrders.map(d => String(d.order_id));
        console.log(`🔍 Total de ${allOrderIds.length} pedidos excluídos no banco.`);

        const keywordRegex = /(peito|frente|costa|costas|pi|manga|perso|personalizada)/i;
        const idsToRestore = new Set<string>();

        // 1. Processar IDs que NÃO são UUIDs (o SKU está no próprio ID)
        const nonUUIDs = allOrderIds.filter(id => !isUUID(id));
        console.log(`🔍 Analisando ${nonUUIDs.length} IDs não-UUID (SKU no ID)...`);

        nonUUIDs.forEach(id => {
            if (keywordRegex.test(id)) {
                idsToRestore.add(id);
            }
        });
        console.log(`✅ ${idsToRestore.size} pedidos identificados via ID texto.`);

        // 2. Processar IDs que SÃO UUIDs (buscar SKU no spreadsheet_data)
        const uuids = allOrderIds.filter(id => isUUID(id));
        console.log(`🔍 Analisando ${uuids.length} IDs UUID (buscando no banco)...`);

        const chunkSize = 100;
        for (let i = 0; i < uuids.length; i += chunkSize) {
            const chunk = uuids.slice(i, i + chunkSize);
            const { data: spreadsheetRows, error: rowsError } = await supabase
                .from('spreadsheet_data')
                .select('id, row_data')
                .in('id', chunk);

            if (rowsError) {
                console.error(`❌ Erro no chunk UUID ${i}:`, rowsError);
                continue;
            }

            spreadsheetRows.forEach(row => {
                const sku = String(row.row_data?.sku || '').toLowerCase();
                if (keywordRegex.test(sku)) {
                    idsToRestore.add(String(row.id));
                }
            });
        }

        if (idsToRestore.size === 0) {
            console.log('✅ Nenhum pedido de Estamparia encontrado para restaurar.');
            return;
        }

        const restoreArray = Array.from(idsToRestore);
        console.log(`📦 Restaurando total de ${restoreArray.length} pedidos...`);

        // 4. Remover da tabela deleted_orders em lotes
        let deletedCount = 0;
        for (let i = 0; i < restoreArray.length; i += chunkSize) {
            const chunk = restoreArray.slice(i, i + chunkSize);
            const { error: deleteError } = await supabase
                .from('deleted_orders')
                .delete()
                .in('order_id', chunk);

            if (deleteError) {
                console.error(`❌ Erro ao deletar lote ${i}:`, deleteError);
            } else {
                deletedCount += chunk.length;
            }
        }

        console.log(`✨ Sucesso! ${deletedCount} pedidos de Estamparia foram restaurados e devem reaparecer.`);
    } catch (error) {
        console.error('❌ Erro durante a restauração:', error);
    }
}

restoreEstampas();
