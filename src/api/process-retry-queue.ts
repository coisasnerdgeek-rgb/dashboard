import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM || process.env.TINY_API_TOKEN;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF;

// Helper to convert DD/MM/YYYY to Date
function convertToDateFromString(dateStr: string): Date {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(0);
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
}

// --- Helper Functions ---

const getEcommerceStore = (orderId: string | number, fileCnpj: 'MM' | 'MVF' | string | null): string => {
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

const parseSkuDynamic = (sku: string, mappings: any) => {
    if (!sku) return { productName: 'N/A', colorName: 'N/A', sizeName: 'N/A' };
    let lowerSku = sku.toLowerCase();

    // Strip kit prefix
    lowerSku = lowerSku.replace(/^kit\d+-/, '');

    const productRules = mappings ? mappings.productMap : {};
    const colorRules = mappings ? mappings.colorMap : {};
    const sizeRules = mappings ? mappings.sizeMap : {};

    // Get product name
    let productName = 'N/A';
    let productKey = '';
    for (const key in productRules) {
        if (lowerSku.startsWith(key)) {
            productKey = key;
            productName = productRules[key];
            break;
        }
    }

    if (productName === 'N/A') {
        const defaultProductMap: Record<string, string> = {
            'polo-fem': 'Polo Feminina', 'polo-masc': 'Polo Masculina',
            'mol-cang': 'Moletom Canguru', 'mol-careca': 'Moletom Careca',
            'cam-masc': 'Camiseta Masculina', 'babylook': 'Babylook',
            'regata': 'Regata', 'capa-': 'Capinha'
        };
        for (const [key, value] of Object.entries(defaultProductMap)) {
            if (lowerSku.startsWith(key)) {
                productKey = key;
                productName = value;
                break;
            }
        }
    }

    const restOfSku = lowerSku.substring(productKey.length).replace(/^-/, '');
    if (!restOfSku) {
        return { productName, colorName: 'N/A', sizeName: 'N/A' };
    }

    const parts = restOfSku.split('-').map(p => p.trim()).filter(p => !!p);

    function findLongestSuffix(parts: string[], rules: Record<string, string>) {
        for (let i = Math.min(parts.length, 3); i > 0; i--) {
            const potentialParts = parts.slice(-i);
            const potentialKey = potentialParts.join('-');
            if (rules[potentialKey]) {
                return {
                    value: rules[potentialKey],
                    key: potentialKey,
                    partsCount: i,
                };
            }
        }
        return null;
    }

    // Attempt 1: Size is Suffix, Color is Suffix of remainder
    let colorName1 = 'N/A';
    let sizeName1 = 'N/A';
    const sizeInfo1 = findLongestSuffix(parts, sizeRules);
    if (sizeInfo1) {
        sizeName1 = sizeInfo1.value;
        const remainingParts1 = parts.slice(0, parts.length - sizeInfo1.partsCount);
        if (remainingParts1.length > 0) {
            const colorInfo1 = findLongestSuffix(remainingParts1, colorRules);
            if (colorInfo1) {
                colorName1 = colorInfo1.value;
            }
        }
    }

    // Attempt 2: Color is Suffix, Size is Suffix of remainder
    let colorName2 = 'N/A';
    let sizeName2 = 'N/A';
    const colorInfo2 = findLongestSuffix(parts, colorRules);
    if (colorInfo2) {
        colorName2 = colorInfo2.value;
        const remainingParts2 = parts.slice(0, parts.length - colorInfo2.partsCount);
        if (remainingParts2.length > 0) {
            const sizeInfo2 = findLongestSuffix(remainingParts2, sizeRules);
            if (sizeInfo2) {
                sizeName2 = sizeInfo2.value;
            }
        }
    }

    // Score and decide which attempt was better
    const score1 = (colorName1 !== 'N/A' ? 1 : 0) + (sizeName1 !== 'N/A' ? 1 : 0);
    const score2 = (colorName2 !== 'N/A' ? 1 : 0) + (sizeName2 !== 'N/A' ? 1 : 0);

    if (score1 > score2) {
        return { productName, colorName: colorName1, sizeName: sizeName1 };
    } else if (score2 > score1) {
        return { productName, colorName: colorName2, sizeName: sizeName2 };
    }

    const finalResult = { colorName: colorName1, sizeName: sizeName1 };

    // Fallback: simple check on last 2 parts
    if ((finalResult.colorName === 'N/A' || finalResult.sizeName === 'N/A') && parts.length >= 2) {
        const potentialSizeKey = parts[parts.length - 1];
        const potentialColorKey = parts[parts.length - 2];

        const sizeMatch = sizeRules[potentialSizeKey];
        const colorMatch = colorRules[potentialColorKey];

        if (sizeMatch && colorMatch) {
            return { productName, colorName: colorMatch, sizeName: sizeMatch };
        }
    }

    // Fallback to static parser logic if we still don't have color/size
    if (finalResult.colorName === 'N/A' && finalResult.sizeName === 'N/A') {
        const defaultColorMap: Record<string, string> = {
            'p': 'Preto', 'b': 'Branco', 'ma': 'Marinho', 'vm': 'Vermelho', 'cm': 'Mescla',
            'ar': 'Royal', 'vi': 'Vinho', 'vde': 'Musgo', 'am': 'Amarelo', 'la': 'Laranja',
            'ch': 'Chumbo', 'at': 'Turquesa', 'pi': 'Pink', 'vl': 'Verde Limao'
        };
        const defaultSizeMap: Record<string, string> = {
            'p': 'P', 'm': 'M', 'g': 'G', 'gg': 'GG', 'xg': 'XG', 'eg': 'EG'
        };
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            if (sizeName1 === 'N/A' && defaultSizeMap[part]) sizeName1 = defaultSizeMap[part];
            else if (colorName1 === 'N/A' && defaultColorMap[part]) colorName1 = defaultColorMap[part];
        }
        return { productName, colorName: colorName1, sizeName: sizeName1 };
    }

    return { productName, colorName: finalResult.colorName, sizeName: finalResult.sizeName };
};


// Function to calculate next retry time with exponential backoff
function calculateNextRetry(retryCount: number): Date {
    const delays = [2, 10, 30, 60, 120, 240]; // minutes
    const delayMinutes = delays[Math.min(retryCount, delays.length - 1)];
    return new Date(Date.now() + delayMinutes * 60 * 1000);
}

// Helper to fetch order by ID
// Helper to fetch order by ID
async function fetchTinyOrder(token: string, id: string): Promise<any> {
    const url = `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${id}&formato=json`;
    try {
        const response = await fetch(url);

        if (response.status === 429) {
            console.warn(`⏳ Rate Limited (429) for ID ${id}. Warning.`);
            throw new Error('Tiny API Rate Limit (429)');
        }

        const data = await response.json();
        if (data.retorno && data.retorno.status === 'OK') {
            return data.retorno.pedido;
        } else if (data.retorno && data.retorno.erros) {
            // Check if it's a "Not Found" error (Code 20) vs others
            const isNotFound = data.retorno.erros.some((e: any) => e.codigo === '20');
            if (isNotFound) return null; // Genuine not found

            // Other errors (e.g. format, internal) should throw to trigger retry with backoff, not be treated as simple "null"
            console.error(`API Error for ID ${id}:`, data.retorno.erros);
            throw new Error(`Tiny API Error: ${JSON.stringify(data.retorno.erros)}`);
        }
    } catch (e: any) {
        // Re-throw if it's our own error, otherwise log and throw generic
        if (e.message.includes('Rate Limit') || e.message.includes('Tiny API Error')) throw e;
        console.error('Fetch exception:', e);
        throw new Error(`Network/Fetch Error: ${e.message}`);
    }
    return null;
}

// Helper to search order by Ecommerce ID
async function searchTinyOrder(token: string, ecommerceId: string): Promise<string | null> {
    const url = `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${token}&numeroEcommerce=${ecommerceId}&formato=json`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.retorno && data.retorno.status === 'OK' && data.retorno.pedidos) {
            // Return the first match's ID
            return data.retorno.pedidos[0].pedido.id;
        }
    } catch (e) {
        console.error('Search exception:', e);
    }
    return null;
}


// Process retry queue - fetch pending orders and retry them
export async function processRetryQueue() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🔄 Processing webhook retry queue...');
    console.log(`🔑 Tokens configured: MVF=${!!TINY_TOKEN_MVF}, MM=${!!TINY_TOKEN_MM}`);

    // Fetch SKU mappings to align parsing with the frontend rules
    let mappings = null;
    try {
        const { data: mappingsData } = await supabase.from('sku_mappings').select('*');
        if (mappingsData) {
            const rawProductMap: Record<string, string> = {};
            const rawColorMap: Record<string, string> = {};
            const rawSizeMap: Record<string, string> = {};
            const rawPhoneBrandMap: Record<string, string> = {};

            mappingsData.forEach((item: any) => {
                if (item.mapping_type === 'product') rawProductMap[item.mapping_key] = item.mapping_value;
                if (item.mapping_type === 'color') rawColorMap[item.mapping_key] = item.mapping_value;
                if (item.mapping_type === 'size') rawSizeMap[item.mapping_key] = item.mapping_value;
                if (item.mapping_type === 'brand') rawPhoneBrandMap[item.mapping_key] = item.mapping_value;
            });

            const sortMap = (map: Record<string, string>) => {
                const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
                const sortedMap: Record<string, string> = {};
                for (const key of sortedKeys) {
                    sortedMap[key] = map[key];
                }
                return sortedMap;
            };

            mappings = {
                productMap: sortMap(rawProductMap),
                colorMap: sortMap(rawColorMap),
                sizeMap: sortMap(rawSizeMap),
                phoneBrandMap: sortMap(rawPhoneBrandMap)
            };
        }
    } catch (e) {
        console.error('Error loading SKU mappings:', e);
    }

    // --- CLEANUP: Delete items older than 60 days ---
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { error: cleanupError, count: deletedCount } = await supabase
        .from('webhook_retry_queue')
        .delete({ count: 'exact' })
        .lt('created_at', sixtyDaysAgo.toISOString())
        .in('status', ['completed', 'failed', 'error']);

    if (!cleanupError && deletedCount !== null && deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old queue items (>60 days)`);
    } else if (cleanupError) {
        console.error('Error cleaning up old queue items:', cleanupError);
    }
    // ------------------------------------------------

    // Fetch pending orders - prioritize by created_at ASC (Oldest First)
    // This ensures that orders delayed by previous failures are eventually processed.
    const { data: pendingOrders, error: fetchError } = await supabase
        .from('webhook_retry_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }) // Changed from false to true
        .limit(5); // Process in small batches of 5 to avoid Vercel 10s Serverless timeout

    // Sort in memory by order_date if available (for backward compatibility)
    if (pendingOrders && pendingOrders.length > 0 && pendingOrders[0].order_date) {
        pendingOrders.sort((a, b) => {
            const dateA = a.order_date ? convertToDateFromString(a.order_date) : new Date(0);
            const dateB = b.order_date ? convertToDateFromString(b.order_date) : new Date(0);
            return dateA.getTime() - dateB.getTime(); // ASC
        });
    }


    if (fetchError) {
        console.error('Error fetching retry queue:', fetchError);
        return { success: false, error: fetchError.message };
    }

    const { count: pendingCount } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    console.log(`📊 Query result: ${pendingOrders?.length || 0} orders fetched, ${pendingCount} total pending in DB`);

    if (!pendingOrders || pendingOrders.length === 0) {
        console.log('📭 No orders to process');
        return { success: true, processed: 0, pendingCount: pendingCount || 0, message: 'No pending orders in queue' };
    }

    console.log(`📦 Found ${pendingOrders.length} orders in queue (Total pending: ${pendingCount})`);


    // Group orders by company for parallel token processing
    const ordersByCompany: Record<string, any[]> = {
        'MVF': pendingOrders.filter(o => o.company === 'MVF'),
        'MM': pendingOrders.filter(o => o.company === 'MM' || !o.company)
    };

    let totalCompleted = 0;
    let totalFailed = 0;
    let totalRetried = 0;

    // Process companies in parallel (each company has its own token/rate limit)
    await Promise.all(Object.entries(ordersByCompany).map(async ([companyName, orders]) => {
        if (orders.length === 0) return;

        const token = (companyName === 'MVF') ? TINY_TOKEN_MVF : TINY_TOKEN_MM;
        if (!token) {
            console.error(`❌ No token for company ${companyName}`);
            return;
        }

        console.log(`🚀 Starting safe processing for ${companyName} (${orders.length} orders, ${pendingCount} total pending)`);

        // 🎯 SAFE STRATEGY to respect Tiny API limits (Max 60 RPM)
        // With CONCURRENCY = 1 and 1000ms delay, we do exactly 1 request per second (60 RPM).
        // Using a slightly higher delay (1200ms) for extra safety overhead.
        const CONCURRENCY = 1; 
        const DELAY_MS = 1200; 

        console.log(`🛡️  SAFE mode: ${CONCURRENCY} concurrent, ${DELAY_MS}ms delay per request`);

        const queue = [...orders];
        let circuitBroken = false;

        const processNext = async (): Promise<void> => {
            if (queue.length === 0 || circuitBroken) return;
            const queueItem = queue.shift()!;

            const { id, order_id, retry_count, max_retries, payload } = queueItem;
            let effectiveCompany = companyName;

            try {
                // Adaptive delay based on queue size
                await new Promise(r => setTimeout(r, DELAY_MS));

                let fullOrder = await fetchTinyOrder(token, order_id);

                if (!fullOrder) {
                    // FALLBACK: Try the OTHER company token if the first one failed (Cross-Check)
                    const otherCompany = (effectiveCompany === 'MVF') ? 'MM' : 'MVF';
                    const otherToken = (otherCompany === 'MVF') ? TINY_TOKEN_MVF : TINY_TOKEN_MM;

                    if (otherToken) {
                        try {
                            const otherOrder = await fetchTinyOrder(otherToken, order_id);
                            if (otherOrder) {
                                fullOrder = otherOrder;
                                effectiveCompany = otherCompany;
                            }
                        } catch (err) {
                            // Ignore fallback errors
                        }
                    }
                }

                if (!fullOrder) {
                    const tinyId = await searchTinyOrder(token, order_id);
                    if (tinyId) fullOrder = await fetchTinyOrder(token, tinyId);
                }

                if (!fullOrder) {
                    const errorMsg = 'Pedido não localizado (ID e Busca Falharam)';
                    if (retry_count + 1 >= max_retries) {
                        await supabase.from('webhook_retry_queue').update({ status: 'failed', last_error: errorMsg, retry_count: retry_count + 1 }).eq('id', String(id));
                        totalFailed++;
                    } else {
                        const nextRetry = calculateNextRetry(retry_count + 1);
                        await supabase.from('webhook_retry_queue').update({ retry_count: retry_count + 1, next_retry_at: nextRetry.toISOString(), last_error: errorMsg }).eq('id', String(id));
                        totalRetried++;
                    }
                } else {
                    // Process Order
                    const IMPORT_DATE = new Date().toISOString();
                    const ecommerceId = fullOrder.numero_ecommerce || fullOrder.ecommerce?.numeroPedidoEcommerce || '';
                    const canal = getEcommerceStore(ecommerceId || fullOrder.numero, effectiveCompany);

                    let itemsRaw = fullOrder.itens || [];
                    if (!Array.isArray(itemsRaw) && itemsRaw.item) itemsRaw = Array.isArray(itemsRaw.item) ? itemsRaw.item : [itemsRaw.item];
                    else if (!Array.isArray(itemsRaw)) itemsRaw = [itemsRaw];

                    const skus = itemsRaw.map((i: any) => (i.item || i)?.codigo).filter(Boolean);
                    let existingRowsForOrder: any[] = [];

                    const { data } = await supabase
                        .from('spreadsheet_data')
                        .select('id, row_data')
                        .eq('row_data->>ID Tiny', String(fullOrder.id));
                    existingRowsForOrder = data || [];

                    const existingSkus = new Set(existingRowsForOrder.map(r => r.row_data?.SKU || r.row_data?.sku));

                    // 🔄 UPDATE STATUS FOR EXISTING ROWS
                    if (existingRowsForOrder.length > 0) {
                        const currentStatus = fullOrder.situacao;
                        const rowsRequiringUpdate = existingRowsForOrder.filter(r =>
                            String(r.row_data["Situação"] || '').toLowerCase() !== String(currentStatus || '').toLowerCase()
                        );

                        for (const row of rowsRequiringUpdate) {
                            await supabase
                                .from('spreadsheet_data')
                                .update({
                                    row_data: { ...row.row_data, "Situação": currentStatus },
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', row.id);
                        }
                    }

                    const rowsToInsert = [];
                    for (const itemWrapper of itemsRaw) {
                        const item = itemWrapper.item || itemWrapper;
                        if (existingSkus.has(item.codigo)) continue;
                        const { productName, colorName, sizeName } = parseSkuDynamic(item.codigo, mappings);

                        rowsToInsert.push({
                            filename: 'Tiny ERP Auto-Import',
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
                                "Origem": "API",
                                "ID Tiny": fullOrder.id,
                                "CNPJ": payload?.cnpj || payload?.dados?.cnpj || fullOrder.cnpj || '',
                                "Empresa": effectiveCompany
                            }
                        });
                    }

                    if (rowsToInsert.length > 0) {
                        await supabase.from('spreadsheet_data').insert(rowsToInsert);
                    }

                    await supabase.from('webhook_retry_queue').update({ status: 'completed' }).eq('id', String(id));
                    totalCompleted++;
                }

            } catch (error: any) {
                console.error(`  💥 Error for order ${order_id}:`, error.message);

                if (error.message.includes('Rate Limit (429)')) {
                    console.error(`  🛑 CIRCUIT BREAKER TRIGGERED for ${companyName}. Aborting run.`);
                    circuitBroken = true;
                    // Reset THIS order to pending (without increasing retry count)
                    await supabase.from('webhook_retry_queue').update({ status: 'pending', last_error: 'Tiny Rate Limit (Circuit Breaker)' }).eq('id', String(id));
                    return;
                }

                if (retry_count + 1 >= max_retries) {
                    await supabase.from('webhook_retry_queue').update({ status: 'failed', last_error: error.message, retry_count: retry_count + 1 }).eq('id', String(id));
                    totalFailed++;
                } else {
                    const nextRetry = calculateNextRetry(retry_count + 1);
                    await supabase.from('webhook_retry_queue').update({ status: 'pending', retry_count: retry_count + 1, next_retry_at: nextRetry.toISOString(), last_error: error.message }).eq('id', String(id));
                    totalRetried++;
                }
            }

            // Small cooldown between requests
            await new Promise(resolve => setTimeout(resolve, 500));
            return processNext();
        };

        await processNext();
    }));

    return {
        success: true,
        completed: totalCompleted,
        retried: totalRetried,
        failed: totalFailed,
        pendingCount: (pendingCount || 0) - totalCompleted
    };
}

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const result = await processRetryQueue();
        return res.status(200).json(result);
    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
