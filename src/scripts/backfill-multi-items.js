
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
function loadEnv() {
    const envFiles = ['.env', '.env.local'];
    for (const file of envFiles) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^"(.*)"$/, '$1');
                    process.env[key] = value;
                }
            });
        }
    }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF || process.env.TINY_API_TOKEN;
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM;

const START_DATE = '2024-12-01T00:00:00Z';

// --- Logic from process-retry-queue.ts reused here ---

const getEcommerceStore = (orderId, fileCnpj) => {
    const id = String(orderId ?? '').trim();
    if (!id) return 'BUSINESS';

    const isShopee = ['26', '2510', 'ID2', '25091', '25010', '25011', '2509', '2501', '2502', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260'].some(prefix => id.startsWith(prefix));
    if (isShopee) {
        if (fileCnpj === 'MM' || fileCnpj?.includes('39447291')) return 'SH MM';
        return 'SH VEST';
    }

    let lojaBase;
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

const parseSku = (sku) => {
    if (!sku) return { productName: 'N/A', colorName: 'N/A', sizeName: 'N/A' };
    const lowerSku = sku.toLowerCase();

    const defaultColorMap = {
        'p': 'Preto', 'b': 'Branco', 'ma': 'Marinho', 'vm': 'Vermelho', 'cm': 'Mescla',
        'ar': 'Royal', 'vi': 'Vinho', 'vde': 'Musgo', 'am': 'Amarelo', 'la': 'Laranja',
        'ch': 'Chumbo', 'at': 'Turquesa', 'pi': 'Pink', 'vl': 'Verde Limao',
        'preto': 'Preto', 'branco': 'Branco', 'marinho': 'Marinho', 'vermelho': 'Vermelho',
        'mescla': 'Mescla', 'royal': 'Royal', 'vinho': 'Vinho', 'musgo': 'Musgo',
        'amarelo': 'Amarelo', 'laranja': 'Laranja', 'chumbo': 'Chumbo', 'turquesa': 'Turquesa',
        'pink': 'Pink', 'rosa': 'Rosa Bebê', 'lilás': 'Lilás'
    };

    const defaultSizeMap = {
        'p': 'P', 'm': 'M', 'g': 'G', 'gg': 'GG', 'xg': 'XG', 'eg': 'EG',
        'g1': 'G1', 'g2': 'G2', 'g3': 'G3', 'g4': 'G4', 'g5': 'G5', 'g6': 'G6',
        '2': '2', '4': '4', '6': '6', '8': '8', '10': '10', '12': '12', '14': '14', '16': '16'
    };

    let productName = 'N/A';
    const productMap = {
        'polo-fem': 'Polo Feminina', 'polo-masc': 'Polo Masculina',
        'mol-cang': 'Moletom Canguru', 'mol-careca': 'Moletom Careca',
        'cam-masc': 'Camiseta Masculina', 'babylook': 'Babylook',
        'regata': 'Regata', 'capa-': 'Capinha', 'cap-': 'Capinha',
        'kit': 'Kit'
    };

    for (const [key, value] of Object.entries(productMap)) {
        if (lowerSku.startsWith(key)) {
            productName = value;
            break;
        }
    }

    let colorName = 'N/A';
    let sizeName = 'N/A';
    const rest = lowerSku.split('-').slice(1);
    for (const part of rest) {
        if (defaultSizeMap[part]) sizeName = defaultSizeMap[part];
        else if (defaultColorMap[part]) colorName = defaultColorMap[part];
    }

    return { productName, colorName, sizeName };
};

// --- Tiny API Helpers ---

async function fetchTinyOrder(token, id) {
    const url = `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${id}&formato=json`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.retorno && data.retorno.status === 'OK') {
            return data.retorno.pedido;
        }
    } catch (e) {
        console.error('Fetch exception:', e.message);
    }
    return null;
}

async function searchTinyOrder(token, ecommerceId) {
    const url = `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${token}&numeroEcommerce=${ecommerceId}&formato=json`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.retorno && data.retorno.status === 'OK' && data.retorno.pedidos) {
            return data.retorno.pedidos[0].pedido.id;
        }
    } catch (e) {
        console.error('Search exception:', e.message);
    }
    return null;
}

// --- Main Backfill Logic ---

async function runBackfill() {
    console.log('🚀 Starting Retroactive Backfill...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Get distinct orders from "spreadsheet_data" since Dec 1st
    // We group by "ID Tiny" or "Identificador do pedido e-commerce"
    // To keep it simple, we iterate all row_data unique combinations
    // But since one order has many rows, this is inefficient.
    // Better: Fetch distinct "ID Tiny" where import_date > start_date

    // Supabase JS doesn't support .distinct() easily on JSONB fields without RPC.
    // So we fetch all ID Tiny and dedup in memory.

    console.log(`fetching orders since ${START_DATE}...`);

    let { data: allRows, error } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .gte('import_date', START_DATE);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    console.log(`Found ${allRows.length} rows. Deduplicating...`);

    const uniqueOrders = new Map(); // Key: TinyID or EcommerceID -> { id, ecommerceId, company }

    for (const row of allRows) {
        const rd = row.row_data;
        const tinyId = rd['ID Tiny'];
        // Use Tiny ID as primary key if available
        if (tinyId) {
            if (!uniqueOrders.has(tinyId)) {
                uniqueOrders.set(tinyId, { id: tinyId, ecommerceId: rd['Identificador do pedido e-commerce'], company: rd['Empresa'] });
            }
        }
    }

    const ordersToProcess = Array.from(uniqueOrders.values());
    console.log(`📋 Identified ${ordersToProcess.length} unique orders to check.`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const order of ordersToProcess) {
        processed++;
        // console.log(`[${processed}/${ordersToProcess.length}] Checking order ${order.id}...`);

        let effectiveCompany = order.company || 'MVF';
        let token = (effectiveCompany === 'MVF') ? TINY_TOKEN_MVF : TINY_TOKEN_MM;

        if (!token) {
            token = TINY_TOKEN_MVF || TINY_TOKEN_MM; // Fallback
        }

        try {
            // ROBUST FETCH (Same as API)
            let fullOrder = await fetchTinyOrder(token, order.id);

            // If not found, try searching by Ecommerce ID
            if (!fullOrder && order.ecommerceId) {
                const tinyId = await searchTinyOrder(token, order.ecommerceId);
                if (tinyId) {
                    fullOrder = await fetchTinyOrder(token, tinyId);
                }
            }

            // Attempt other company
            if (!fullOrder) {
                const otherCompany = (effectiveCompany === 'MVF') ? 'MM' : 'MVF';
                const otherToken = (otherCompany === 'MVF') ? TINY_TOKEN_MVF : TINY_TOKEN_MM;
                if (otherToken) {
                    fullOrder = await fetchTinyOrder(otherToken, order.id);
                    if (!fullOrder && order.ecommerceId) {
                        const tinyId = await searchTinyOrder(otherToken, order.ecommerceId);
                        if (tinyId) fullOrder = await fetchTinyOrder(otherToken, tinyId);
                    }
                    if (fullOrder) effectiveCompany = otherCompany;
                }
            }

            if (!fullOrder) {
                // console.log(`  ❌ Not found: ${order.id}`);
                errors++;
                continue;
            }

            // Check Items
            let itemsRaw = fullOrder.itens || [];
            if (!Array.isArray(itemsRaw) && itemsRaw.item) itemsRaw = Array.isArray(itemsRaw.item) ? itemsRaw.item : [itemsRaw.item];
            else if (!Array.isArray(itemsRaw)) itemsRaw = [itemsRaw];

            if (itemsRaw.length <= 1) {
                // Single item orders likely fine (unless we missed it entirely, but we are iterating EXISTING orders)
                // Actually, logic handles fetching ALL items. If DB has 1 and Tiny has 1, we are good.
                // We proceed to check/insert anyway to be safe.
            }

            const ecommerceId = fullOrder.numero_ecommerce || fullOrder.ecommerce?.numeroPedidoEcommerce || '';
            const canal = getEcommerceStore(ecommerceId || fullOrder.numero, effectiveCompany);
            const IMPORT_DATE = new Date().toISOString();

            let addedItems = 0;

            for (const itemWrapper of itemsRaw) {
                const item = itemWrapper.item || itemWrapper;
                const { productName, colorName, sizeName } = parseSku(item.codigo);

                // Check DB
                const { data: duplicateItem } = await supabase
                    .from('spreadsheet_data')
                    .select('id')
                    .eq('row_data->>ID Tiny', String(fullOrder.id))
                    .eq('row_data->>SKU', item.codigo)
                    .limit(1);

                if (duplicateItem && duplicateItem.length > 0) {
                    continue; // Skip existing
                }

                // Prepare Insert
                const rowToInsert = {
                    filename: 'Backfill Fix',
                    import_date: IMPORT_DATE,
                    row_data: {
                        "Data": fullOrder.data_pedido,
                        "Número da ordem de compra": ecommerceId || fullOrder.numero,
                        "Identificador do pedido e-commerce": ecommerceId,
                        "Data máxima de despacho": fullOrder.data_prevista || '',
                        "Nome": fullOrder.cliente?.nome || fullOrder.cliente?.nome_contato || 'Cliente Desconhecido',
                        "SKU": item.codigo,
                        "Descrição": item.descricao,
                        "Quantidade": item.quantidade,
                        "Valor Unitario": item.valor_unitario,
                        "Situação": fullOrder.situacao,
                        "Canal": canal,
                        "Produto": productName,
                        "Cor": colorName,
                        "Tamanho": sizeName,
                        "Origem": "API-Backfill",
                        "ID Tiny": fullOrder.id,
                        "CNPJ": fullOrder.cnpj || '',
                        "Empresa": effectiveCompany
                    }
                };

                const { error: insertError } = await supabase.from('spreadsheet_data').insert(rowToInsert);
                if (insertError) console.error(`  ⚠️ Insert error:`, insertError);
                else {
                    addedItems++;
                }
            }

            if (addedItems > 0) {
                console.log(`  ✅ Verified ${order.id}: Added ${addedItems} missing items.`);
                updated++;
            }

            // Rate Limit
            await new Promise(r => setTimeout(r, 3000)); // 3 sec delay = 20 req/min max to be safe

        } catch (err) {
            console.error(`  💥 Fatal error for ${order.id}:`, err.message);
            errors++;
        }
    }

    console.log(`\n🎉 Backfill Complete!`);
    console.log(`- Processed: ${processed}`);
    console.log(`- Updated (Recovered): ${updated} orders`);
    console.log(`- Errors/Not Found: ${errors}`);
}

runBackfill();
