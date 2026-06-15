import { createClient } from '@supabase/supabase-js';

// Tiny API tokens for multiple accounts
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN; // MVF account
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM; // MM account
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface TinySearchParams {
    dataInicial: string; // DD/MM/YYYY
    dataFinal: string;   // DD/MM/YYYY
    situacao?: string;   // opcional: filtrar por situação
}

async function searchTinyOrders(params: TinySearchParams, token: string, accountName: string) {
    let allOrders: any[] = [];
    let currentPage = 1;
    let totalPages = 1;

    console.log(`[${accountName}] Starting pagination...`);

    do {
        const url = `https://api.tiny.com.br/api2/pedidos.pesquisa.php`;
        const searchParams = new URLSearchParams();
        searchParams.append('token', token);
        searchParams.append('formato', 'json');
        searchParams.append('dataInicial', params.dataInicial);
        searchParams.append('dataFinal', params.dataFinal);
        searchParams.append('pagina', String(currentPage));
        if (params.situacao) {
            searchParams.append('situacao', params.situacao);
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: searchParams,
            });
            const data = await response.json();

            if (data.retorno && data.retorno.status === 'OK') {
                const pageOrders = data.retorno.pedidos || [];
                allOrders.push(...pageOrders);

                totalPages = parseInt(data.retorno.numero_paginas) || 1;

                console.log(`[${accountName}] Page ${currentPage}/${totalPages}: ${pageOrders.length} orders`);

                currentPage++;

                // Delay to avoid rate limiting
                if (currentPage <= totalPages) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                console.error(`[${accountName}] Error on page ${currentPage}:`, JSON.stringify(data));
                break;
            }
        } catch (error) {
            console.error(`[${accountName}] Fetch error on page ${currentPage}:`, error);
            break;
        }
    } while (currentPage <= totalPages);

    console.log(`[${accountName}] ✓ Total orders fetched: ${allOrders.length}`);
    return allOrders;
}

async function fetchTinyOrderDetails(id: string, token: string) {
    const url = `https://api.tiny.com.br/api2/pedido.obter.php`;
    const params = new URLSearchParams();
    params.append('token', token);
    params.append('id', id);
    params.append('formato', 'json');

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: params,
        });
        const data = await response.json();
        if (data.retorno && data.retorno.status === 'OK') {
            return data.retorno.pedido;
        }
        // Log detalhado do erro
        const errorMsg = data.retorno?.erros?.[0]?.erro || data.retorno?.status_processamento || 'Unknown error';
        console.error(`Failed to fetch order ${id}: ${errorMsg}`);
        return null;
    } catch (error) {
        console.error(`Fetch error for order ${id}:`, error);
        return null;
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!TINY_TOKEN_MVF || !SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing env vars:', { TINY_TOKEN_MVF: !!TINY_TOKEN_MVF, TINY_TOKEN_MM: !!TINY_TOKEN_MM, SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY });
        return res.status(500).json({ error: 'Missing environment variables' });
    }

    try {
        const { dataInicial, dataFinal } = req.body;

        if (!dataInicial || !dataFinal) {
            return res.status(400).json({ error: 'dataInicial and dataFinal are required (DD/MM/YYYY)' });
        }

        // Build list of tokens to use
        const tokensToUse: { token: string; accountName: string }[] = [];
        if (TINY_TOKEN_MVF) tokensToUse.push({ token: TINY_TOKEN_MVF, accountName: 'MVF' });
        if (TINY_TOKEN_MM) tokensToUse.push({ token: TINY_TOKEN_MM, accountName: 'MM' });

        console.log(`Searching Tiny orders from ${dataInicial} to ${dataFinal} across ${tokensToUse.length} account(s)`);

        // Collect all orders from all accounts in parallel
        console.log(`Searching Tiny orders from ${dataInicial} to ${dataFinal} across ${tokensToUse.length} account(s)`);

        const accountResults = await Promise.all(tokensToUse.map(async ({ token, accountName }) => {
            console.log(`Fetching orders from ${accountName} account...`);
            const orders = await searchTinyOrders({ dataInicial, dataFinal }, token, accountName);
            console.log(`Found ${orders?.length || 0} orders from ${accountName}`);
            return (orders || []).map(order => ({ order, accountName, token }));
        }));

        let allOrders = accountResults.flat();

        if (allOrders.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No orders found in the specified period',
                total: 0,
                imported: 0,
                errors: 0
            });
        }

        console.log(`Found ${allOrders.length} total orders across all accounts`);

        // 2. Conectar ao Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

        let imported = 0;
        let errors = 0;
        let skipped = 0;
        const errorDetails: string[] = [];

        // 3. Process orders in parallel by account, respecting rate limits and Vercel timeouts
        // Tiny API has limit of ~60 requests per minute per token.
        // Vercel Hobby has a 10s timeout, so we aim for high concurrency with safe delays.
        const BATCH_SIZE_PER_ACCOUNT = 10;
        const CONCURRENCY_PER_ACCOUNT = 5;
        const DELAY_BETWEEN_REQUESTS = 1000; // ms - optimized for 60 RPM

        // Group by account
        const ordersByAccount: Record<string, any[]> = {
            'MVF': allOrders.filter(o => o.accountName === 'MVF').slice(0, BATCH_SIZE_PER_ACCOUNT),
            'MM': allOrders.filter(o => o.accountName === 'MM').slice(0, BATCH_SIZE_PER_ACCOUNT)
        };

        const { data: results } = await (async () => {
            let totalImported = 0;
            let totalErrors = 0;
            let totalSkipped = 0;

            await Promise.all(Object.entries(ordersByAccount).map(async ([accountName, orders]) => {
                if (orders.length === 0) return;

                console.log(`[${accountName}] Processing ${orders.length} orders in parallel...`);
                const token = (accountName === 'MVF') ? TINY_TOKEN_MVF! : TINY_TOKEN_MM!;
                const queue = [...orders];

                const processNext = async (): Promise<void> => {
                    if (queue.length === 0) return;
                    const { order: orderSummary } = queue.shift()!;
                    const orderId = orderSummary.pedido?.id;

                    if (!orderId) {
                        totalErrors++;
                        return processNext();
                    }

                    try {
                        // Fetch full order details
                        const pedido = await fetchTinyOrderDetails(orderId, token);
                        if (!pedido) {
                            errorDetails.push(`[${accountName}] Failed to fetch details for order ${orderId}`);
                            totalErrors++;
                        } else {
                            // Process components
                            let itens = pedido.itens;
                            if (!Array.isArray(itens)) itens = itens ? [itens] : [];

                            // OPTIMIZED: Batch duplicate check with IN clause using ID Tiny
                            const { data: existingItems } = await supabase
                                .from('spreadsheet_data')
                                .select('row_data')
                                .eq('row_data->>ID Tiny', String(pedido.id));

                            const existingSkus = new Set(existingItems?.map((r: any) => r.row_data?.SKU || r.row_data?.sku) || []);

                            const rowsToInsert = [];
                            for (const itemWrapper of itens) {
                                const item = itemWrapper?.item || itemWrapper;
                                if (!item) continue;

                                // Skip duplicates using cached set
                                if (existingSkus.has(item.codigo)) {
                                    totalSkipped++;
                                    continue;
                                }

                                const empresa = accountName;
                                const cnpj = pedido.cnpj || '';
                                const parsed = parseSkuDynamic(item.codigo, mappings);
                                const ecommerceId = pedido.numero_ecommerce || pedido.numero;
                                const canal = getEcommerceStore(ecommerceId, empresa as 'MM' | 'MVF');

                                const row_data: any = {
                                    "Data": pedido.data_pedido || '',
                                    "Número da ordem de compra": ecommerceId,
                                    "Identificador do pedido e-commerce": ecommerceId,
                                    "Data máxima de despacho": pedido.data_prevista || '',
                                    "Nome": pedido.cliente?.nome || '',
                                    "SKU": item.codigo || '',
                                    "Descrição": item.descricao || '',
                                    "Quantidade": item.quantidade ? Number(item.quantidade) : 1,
                                    "Valor Unitario": item.valor_unitario ? Number(item.valor_unitario) : 0,
                                    "Situação": pedido.situacao || 'Em aberto',
                                    "Canal": canal,
                                    "Produto": parsed.productName,
                                    "Cor": parsed.colorName,
                                    "Tamanho": parsed.sizeName,
                                    "Origem": "API",
                                    "ID Tiny": String(pedido.id),
                                    "CNPJ": cnpj,
                                    "Empresa": empresa
                                };

                                rowsToInsert.push({
                                    filename: `tiny_import_${dataInicial.replace(/\//g, '-')}_${dataFinal.replace(/\//g, '-')}`,
                                    import_date: new Date().toISOString(),
                                    row_data,
                                    created_at: new Date().toISOString(),
                                });
                            }

                            if (rowsToInsert.length > 0) {
                                const { error: insertError } = await supabase.from('spreadsheet_data').insert(rowsToInsert);
                                if (insertError) {
                                    console.error('Supabase insert error:', insertError);
                                    totalErrors++;
                                } else {
                                    totalImported += rowsToInsert.length;
                                }
                            }
                        }
                    } catch (err: any) {
                        console.error(`[${accountName}] Error processing order ${orderId}:`, err);
                        totalErrors++;
                    }

                    // Delay per thread to respect rate limit
                    await new Promise(r => setTimeout(r, DELAY_BETWEEN_REQUESTS));
                    return processNext();
                };

                // Start threads for this account
                await Promise.all(Array(CONCURRENCY_PER_ACCOUNT).fill(null).map(() => processNext()));
            }));

            return { data: { imported: totalImported, skipped: totalSkipped, errors: totalErrors } };
        })();

        imported = results.imported;
        skipped = results.skipped;
        errors = results.errors;

        console.log('Import completed. Summary:', results);

        return res.status(200).json({
            success: true,
            message: `Import completed`,
            total: allOrders.length,
            processed: results.imported + results.skipped + results.errors,
            imported,
            skipped,
            errors,
            errorSamples: errorDetails.slice(0, 5),
        });

    } catch (error: any) {
        console.error('Import error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// Updated Helper Functions to match latest business logic
function getEcommerceStore(orderId: string | number, empresa: 'MM' | 'MVF' | null): string {
    const id = String(orderId ?? '').trim();
    if (!id) return 'BUSINESS';

    const isShopee = ['26', '2510', 'ID2', '25091', '25010', '25011', '2509', '2501', '2502', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260'].some(prefix => id.startsWith(prefix));
    if (isShopee) {
        if (empresa === 'MM') return 'SH MM';
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

    if (empresa === 'MM' && lojaBase !== 'BUSINESS') {
        return lojaBase.replace('VEST', 'MM');
    }

    return lojaBase;
}

function parseSkuDynamic(sku: string, mappings: any) {
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
}

