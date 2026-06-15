import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const tinyToken = process.env.TINY_API_TOKEN!;

const FILENAME = "Tiny ERP Auto-Import";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (!supabaseUrl || !supabaseKey || !tinyToken) {
            return res.status(500).json({ error: 'Missing environment variables' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

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

        console.log('🔄 Manual retry queue processing triggered');

        // Get all pending retries (using correct schema!)
        const { data: pendingRetries, error: fetchError } = await supabase
            .from('webhook_retry_queue')
            .select('*')
            .eq('status', 'pending')
            .order('next_retry_at', { ascending: true });

        if (fetchError) {
            console.error('Error fetching retry queue:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch retry queue', details: fetchError.message });
        }

        if (!pendingRetries || pendingRetries.length === 0) {
            return res.status(200).json({
                message: 'No pending retries',
                processed: 0
            });
        }

        console.log(`📋 Found ${pendingRetries.length} pending retries`);

        const results = {
            total: pendingRetries.length,
            processed: 0,
            failed: 0,
            details: [] as any[]
        };

        // Process each retry
        for (const retry of pendingRetries) {
            try {
                console.log(`⏳ Processing retry for order: ${retry.order_id}`);

                // Fetch order from Tiny API
                const tinyResponse = await fetch(
                    `https://api.tiny.com.br/api2/pedido.obter.php?token=${tinyToken}&id=${retry.order_id}&formato=json`,
                    { method: 'GET' }
                );

                const tinyData = await tinyResponse.json();

                if (tinyData?.retorno?.status_processamento === '3' && tinyData?.retorno?.pedido) {
                    // Order found! Process it
                    console.log(`✅ Order ${retry.order_id} found in Tiny API - processing now`);

                    const pedido = tinyData.retorno.pedido;

                    // Check for duplicates before inserting
                    const { data: existingOrders } = await supabase
                        .from('spreadsheet_data')
                        .select('*')
                        .eq('filename', FILENAME)
                        .filter('row_data->>ID Tiny', 'eq', String(retry.order_id));

                    if (existingOrders && existingOrders.length > 0) {
                        console.log(`⚠️ Order ${retry.order_id} already exists - skipping`);
                        await supabase
                            .from('webhook_retry_queue')
                            .update({ status: 'completed' })
                            .eq('id', String(retry.id));

                        results.details.push({
                            order_id: retry.order_id,
                            status: 'duplicate'
                        });
                        continue;
                    }

                    // Process items and insert
                    const items = Array.isArray(pedido.itens) ? pedido.itens : [pedido.itens?.item].filter(Boolean);

                    const rowsToInsert = items.map((item: any) => {
                        const parsed = parseSkuDynamic(item.codigo, mappings);
                        return {
                            filename: FILENAME,
                            import_date: new Date().toISOString(),
                            row_data: {
                                "SKU": item.codigo,
                                "Produto": parsed.productName,
                                "Cor": parsed.colorName,
                                "Tamanho": parsed.sizeName,
                                "Quantidade": item.quantidade,
                                "Valor Unitario": item.valor_unitario,
                                "Nome": pedido.cliente?.nome || "",
                                "Data": pedido.data_pedido,
                            "Número da ordem de compra": pedido.numero_ecommerce || "",
                            "ID Tiny": String(retry.order_id),
                            "Canal": pedido.nome_ecommerce || "N/A",
                            "Situação": pedido.situacao,
                            "CNPJ": retry.cnpj,
                            "Empresa": retry.company,
                            "Origem": "Tiny ERP Webhook (Retry)",
                            "Data máxima de despacho": pedido.data_prevista || "",
                            "Identificador do pedido e-commerce": pedido.numero_ecommerce || "",
                            "Descrição": item.descricao || ""
                            }
                        };
                    });

                    const { error: insertError } = await supabase
                        .from('spreadsheet_data')
                        .insert(rowsToInsert);

                    if (insertError) {
                        console.error(`❌ Error inserting order ${retry.order_id}:`, insertError);
                        results.failed++;
                        results.details.push({
                            order_id: retry.order_id,
                            status: 'error',
                            error: insertError.message
                        });
                    } else {
                        // Mark as completed
                        await supabase
                            .from('webhook_retry_queue')
                            .update({ status: 'completed' })
                            .eq('id', String(retry.id));

                        results.processed++;
                        results.details.push({
                            order_id: retry.order_id,
                            status: 'success',
                            items_inserted: rowsToInsert.length
                        });
                        console.log(`✅ Order ${retry.order_id} successfully processed!`);
                    }

                } else if (tinyData?.retorno?.codigo_erro === '32') {
                    // Still not found
                    if ((retry.retry_count || 0) >= 10) {
                        // Give up after 10 attempts
                        await supabase
                            .from('webhook_retry_queue')
                            .update({ status: 'failed', last_error: 'Max retries reached' })
                            .eq('id', String(retry.id));

                        results.failed++;
                        results.details.push({
                            order_id: retry.order_id,
                            status: 'gave_up',
                            reason: 'Max retries reached'
                        });
                    } else {
                        // Increment retry count
                        const newRetryCount = (retry.retry_count || 0) + 1;
                        const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

                        await supabase
                            .from('webhook_retry_queue')
                            .update({
                                retry_count: newRetryCount,
                                next_retry_at: nextRetryAt.toISOString(),
                                last_error: 'Order still not found'
                            })
                            .eq('id', String(retry.id));

                        results.details.push({
                            order_id: retry.order_id,
                            status: 'rescheduled',
                            next_retry: nextRetryAt.toISOString()
                        });
                    }
                } else {
                    // Other error
                    await supabase
                        .from('webhook_retry_queue')
                        .update({ status: 'failed', last_error: JSON.stringify(tinyData) })
                        .eq('id', String(retry.id));

                    results.failed++;
                    results.details.push({
                        order_id: retry.order_id,
                        status: 'error',
                        error: tinyData
                    });
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error: any) {
                console.error(`Error processing retry ${retry.order_id}:`, error);
                results.failed++;
                results.details.push({
                    order_id: retry.order_id,
                    status: 'error',
                    error: error.message
                });
            }
        }

        return res.status(200).json({
            message: 'Retry queue processed',
            ...results
        });

    } catch (error: any) {
        console.error('Manual retry error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
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
