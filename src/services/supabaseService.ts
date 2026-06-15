import { supabase } from './supabaseClient';
import {
    PhoneCaseModel,
    PriceProduct,
    SavedOrder,
    DelayRules,
    BackorderedItem,
    VerificationStatus,
    ImageCategory,
    EstampaRow,
    Store
} from '../types';

// --- Generic Types ---

export interface SkuMapping {
    id?: string;
    mapping_type: 'product' | 'color' | 'size' | 'brand';
    mapping_key: string;
    mapping_value: string;
}

export interface ImageMapping {
    id?: string;
    sku: string;
    url: string;
    category_id: string | null;
}

// --- Phone Case Models ---

export const getPhoneCaseModels = async (): Promise<Record<string, PhoneCaseModel[]>> => {
    const { data, error } = await supabase
        .from('phone_case_models')
        .select('*');

    if (error) throw error;

    const modelsByBrand: Record<string, PhoneCaseModel[]> = {};
    data?.forEach((item: any) => {
        if (!modelsByBrand[item.brand]) {
            modelsByBrand[item.brand] = [];
        }
        modelsByBrand[item.brand].push({
            name: item.name,
            inStock: item.in_stock
        });
    });

    // Sort models within each brand
    Object.keys(modelsByBrand).forEach(brand => {
        modelsByBrand[brand].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    });

    return modelsByBrand;
};

export const savePhoneCaseModel = async (brand: string, model: PhoneCaseModel) => {
    const { error } = await supabase
        .from('phone_case_models')
        .upsert({
            brand,
            name: model.name,
            in_stock: model.inStock
        }, { onConflict: 'brand,name' });

    if (error) throw error;
};

export const deletePhoneCaseModel = async (brand: string, name: string) => {
    const { count, error } = await supabase
        .from('phone_case_models')
        .delete({ count: 'exact' })
        .match({ brand, name });

    if (error) throw error;
    return count;
};

export const renamePhoneCaseBrand = async (oldBrand: string, newBrand: string) => {
    // This is a multi-step operation:
    // 1. Get all models for the old brand
    // 2. Insert them with the new brand
    // 3. Delete the old brand entries
    // Ideally this should be a stored procedure or a single query if possible, but RLS/Supabase client might limit us.
    // A simple update on 'brand' column where brand = oldBrand works if 'brand' is just a column in 'phone_case_models'.

    const { error } = await supabase
        .from('phone_case_models')
        .update({ brand: newBrand })
        .eq('brand', oldBrand);

    if (error) throw error;
};

// --- SKU Mappings ---

export const getSkuMappings = async (): Promise<{
    productMap: Record<string, string>;
    colorMap: Record<string, string>;
    sizeMap: Record<string, string>;
    phoneBrandMap: Record<string, string>;
}> => {
    const { data, error } = await supabase
        .from('sku_mappings')
        .select('*');

    if (error) throw error;

    const result = {
        productMap: {} as Record<string, string>,
        colorMap: {} as Record<string, string>,
        sizeMap: {} as Record<string, string>,
        phoneBrandMap: {} as Record<string, string>,
    };

    data?.forEach((item: SkuMapping) => {
        if (item.mapping_type === 'product') result.productMap[item.mapping_key] = item.mapping_value;
        if (item.mapping_type === 'color') result.colorMap[item.mapping_key] = item.mapping_value;
        if (item.mapping_type === 'size') result.sizeMap[item.mapping_key] = item.mapping_value;
        if (item.mapping_type === 'brand') result.phoneBrandMap[item.mapping_key] = item.mapping_value;
    });

    return result;
};

export const saveSkuMapping = async (type: 'product' | 'color' | 'size' | 'brand', key: string, value: string) => {
    const { error } = await supabase
        .from('sku_mappings')
        .upsert({
            mapping_type: type,
            mapping_key: key,
            mapping_value: value
        }, { onConflict: 'mapping_type,mapping_key' });

    if (error) throw error;
};

export const deleteSkuMapping = async (type: 'product' | 'color' | 'size' | 'brand', key: string) => {
    const { error } = await supabase
        .from('sku_mappings')
        .delete()
        .match({ mapping_type: type, mapping_key: key });

    if (error) throw error;
};

// --- Image Mappings ---

export const getImageCategories = async (): Promise<ImageCategory[]> => {
    const { data, error } = await supabase.from('image_categories').select('*');
    if (error) throw error;
    return data || [];
};

export const saveImageCategory = async (category: ImageCategory) => {
    const { error } = await supabase.from('image_categories').upsert(category);
    if (error) throw error;
};

export const deleteImageCategory = async (id: string) => {
    const { error } = await supabase.from('image_categories').delete().eq('id', String(id));
    if (error) throw error;
};

export const renameImageCategory = async (id: string, newName: string) => {
    const { error } = await supabase
        .from('image_categories')
        .update({ name: newName })
        .eq('id', String(id));
    if (error) throw error;
};

export const getImageMappings = async (): Promise<{ mappings: Record<string, string>, assignments: Record<string, string | null> }> => {
    const { data, error } = await supabase.from('image_mappings').select('*');
    if (error) throw error;

    const mappings: Record<string, string> = {};
    const assignments: Record<string, string | null> = {};

    data?.forEach((item: any) => {
        mappings[item.sku] = item.url;
        assignments[item.sku] = item.category_id;
    });

    return { mappings, assignments };
};

export const saveImageMapping = async (sku: string, url: string, categoryId: string | null = null) => {
    const { error } = await supabase
        .from('image_mappings')
        .upsert({ sku, url, category_id: categoryId }, { onConflict: 'sku' });

    if (error) throw error;
};

export const deleteImageMapping = async (sku: string) => {
    const { error } = await supabase.from('image_mappings').delete().eq('sku', sku);
    if (error) throw error;
};

// --- Price Tables ---

export const getPriceTables = async (): Promise<PriceProduct[]> => {
    const { data, error } = await supabase.from('price_tables').select('*');
    if (error) throw error;

    return data?.map((item: any) => ({
        id: item.id,
        category: item.category,
        product: item.product,
        skuProductName: item.sku_product_name,
        prices: item.prices_json
    })) || [];
};

export const savePriceTable = async (product: PriceProduct) => {
    const { error } = await supabase
        .from('price_tables')
        .upsert({
            id: product.id,
            category: product.category,
            product: product.product,
            sku_product_name: product.skuProductName,
            prices_json: product.prices
        });

    if (error) throw error;
};

// --- Saved Orders ---

export const getSavedOrders = async (days?: number): Promise<SavedOrder[]> => {
    let query = supabase
        .from('saved_orders')
        .select('*')
        .is('archived_date', null);

    if (days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        query = query.gte('created_at', date.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    return data?.map((item: any) => ({
        ...item.data_json,
        id: item.id // Ensure ID matches
    })) || [];
};

// --- Paginated Orders (Performance Optimization) ---

export interface OrdersPage {
    orders: SavedOrder[];
    hasMore: boolean;
    oldestDate: string | null;
    totalCount: number;
}

export const getSavedOrdersPaginated = async (
    monthsBack: number = 1,
    beforeDate?: string
): Promise<OrdersPage> => {
    console.log(`[getSavedOrdersPaginated] 📦 Carregando pedidos: ${monthsBack} mes(es) ${beforeDate ? `antes de ${beforeDate}` : 'recentes'}`);

    // Calculate date limit
    const limitDate = new Date(beforeDate || new Date());
    limitDate.setMonth(limitDate.getMonth() - monthsBack);

    // Get orders within date range
    const { data, error } = await supabase
        .from('saved_orders')
        .select('*')
        .is('archived_date', null)
        .gte('created_at', limitDate.toISOString())
        .lt('created_at', beforeDate || new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1000); // Safety limit

    if (error) {
        console.error('[getSavedOrdersPaginated] ❌ Erro:', error);
        throw error;
    }

    const orders = data?.map((item: any) => ({
        ...item.data_json,
        id: item.id,
        created_at: item.created_at // Include created_at for tracking
    })) || [];

    console.log(`[getSavedOrdersPaginated] ✅ ${orders.length} pedidos carregados`);

    // Get oldest date from loaded orders
    const oldestOrder = orders[orders.length - 1];
    const oldestDate = oldestOrder?.created_at || null;

    // Check if there are more orders before this date
    const { count: olderCount } = await supabase
        .from('saved_orders')
        .select('*', { count: 'exact', head: true })
        .is('archived_date', null)
        .lt('created_at', oldestDate || limitDate.toISOString());

    const hasMore = (olderCount || 0) > 0;

    console.log(`[getSavedOrdersPaginated] ${hasMore ? '📦 Há mais pedidos antigos' : '✅ Todos pedidos carregados'}`);

    return {
        orders,
        hasMore,
        oldestDate,
        totalCount: orders.length
    };
};

// --- Dashboard Metrics (Separate Query for Accuracy) ---

export interface DashboardMetrics {
    totalPedidos: number;
    faturamentoTotal: number;
    pedidosPorStatus: Record<string, number>;
    pedidosPorLoja: Record<string, number>;
}

export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
    console.log('[getDashboardMetrics] 📊 Calculando métricas de todos os pedidos...');

    // Get minimal data needed for metrics to reduce egress
    const { data, error } = await supabase
        .from('saved_orders')
        .select('data_json->status, data_json->totalValue, data_json->loja')
        .is('archived_date', null);

    if (error) {
        console.error('[getDashboardMetrics] ❌ Erro:', error);
        throw error;
    }

    const allOrders = data || [];

    console.log(`[getDashboardMetrics] ✅ Processando ${allOrders.length} pedidos...`);

    // Calculate metrics
    const metrics: DashboardMetrics = {
        totalPedidos: 0,
        faturamentoTotal: 0,
        pedidosPorStatus: {},
        pedidosPorLoja: {}
    };

    allOrders.forEach(order => {
        // Exclude cancelled orders from count
        if (order.status?.toLowerCase() !== 'cancelado') {
            metrics.totalPedidos++;
        }

        // Exclude "dados incompletos" from revenue
        if (order.status?.toLowerCase() !== 'dados incompletos' &&
            order.status?.toLowerCase() !== 'cancelado') {
            metrics.faturamentoTotal += order.totalValue || 0;
        }

        // Count by status
        const status = order.status || 'Sem Status';
        metrics.pedidosPorStatus[status] = (metrics.pedidosPorStatus[status] || 0) + 1;

        // Count by store
        const loja = order.loja || 'Sem Loja';
        metrics.pedidosPorLoja[loja] = (metrics.pedidosPorLoja[loja] || 0) + 1;
    });

    console.log('[getDashboardMetrics] ✅ Métricas calculadas');
    console.log(`  - Total pedidos (sem cancelados): ${metrics.totalPedidos}`);
    console.log(`  - Faturamento: R$ ${metrics.faturamentoTotal.toFixed(2)}`);

    return metrics;
};

export const saveOrder = async (order: SavedOrder) => {
    const { error } = await supabase
        .from('saved_orders')
        .upsert({
            id: order.id,
            data_json: order,
            archived_date: null
        });

    if (error) throw error;
};

export const saveArchivedOrder = async (order: SavedOrder & { archivedDate: string }) => {
    const { error } = await supabase
        .from('saved_orders')
        .upsert({
            id: order.id,
            data_json: order,
            archived_date: order.archivedDate
        });

    if (error) throw error;
};

export const deleteOrder = async (id: string) => {
    console.log('[deleteOrder] 🗑️ Attempting to delete order with ID:', id);
    console.log('[deleteOrder] ID type:', typeof id);
    console.log('[deleteOrder] ID as String:', String(id));

    const { data, error, count } = await supabase
        .from('saved_orders')
        .delete({ count: 'exact' })
        .eq('id', String(id))
        .select(); // Added select to see what was actually deleted

    if (error) {
        console.error('[deleteOrder] ❌ DELETE FAILED');
        console.error('[deleteOrder] Error:', error);
        console.error('[deleteOrder] Error code:', error.code);
        console.error('[deleteOrder] Error message:', error.message);
        console.error('[deleteOrder] Error details:', error.details);
        console.error('[deleteOrder] Error hint:', error.hint);
        throw error;
    }

    console.log('[deleteOrder] ✅ DELETE SUCCESSFUL');
    console.log('[deleteOrder] Rows deleted:', count);
    console.log('[deleteOrder] Deleted data:', data);

    if (count === 0) {
        console.warn('[deleteOrder] ⚠️ WARNING: No rows were deleted! Order may not exist or RLS policy may be blocking the delete.');
    }
};

// --- Delay Rules ---

export const getDelayRules = async (): Promise<DelayRules> => {
    const { data, error } = await supabase.from('delay_rules').select('*');
    if (error) throw error;

    const rules: DelayRules = {};
    data?.forEach((item: any) => {
        rules[item.store_name] = {
            onTime: item.on_time_days,
            atRisk: item.at_risk_days
        };
    });
    return rules;
};

export const saveDelayRule = async (storeName: string, rule: { onTime: number, atRisk: number }) => {
    const { error } = await supabase
        .from('delay_rules')
        .upsert({
            store_name: storeName,
            on_time_days: rule.onTime,
            at_risk_days: rule.atRisk
        }, { onConflict: 'store_name' });

    if (error) throw error;
};

// --- Backordered Items ---

export const getBackorderedItems = async (): Promise<BackorderedItem[]> => {
    const { data, error } = await supabase
        .from('backordered_items')
        .select('*')
        .eq('is_resolved', false); // Note: Ensure this matches your Supabase schema (is_resolved)

    if (error) throw error;

    return data?.map((item: any) => ({
        ...item.data_json,
        id: item.id
    })) || [];
};

export const getResolvedBackorderedItems = async (): Promise<BackorderedItem[]> => {
    const { data, error } = await supabase
        .from('backordered_items')
        .select('*')
        .eq('is_resolved', true);

    if (error) throw error;

    return data?.map((item: any) => ({
        ...item.data_json,
        id: item.id,
        resolvedDate: item.resolved_at || item.data_json.resolvedDate // Ensure we get the date
    })) || [];
};

export const saveBackorderedItem = async (item: BackorderedItem) => {
    const { error } = await supabase
        .from('backordered_items')
        .upsert({
            id: item.id,
            data_json: item,
            is_resolved: false
        });

    if (error) throw error;
};

export const resolveBackorderedItem = async (id: string) => {
    const { error } = await supabase
        .from('backordered_items')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', String(id));

    if (error) throw error;
};

export const unresolveBackorderedItem = async (id: string) => {
    const { error } = await supabase
        .from('backordered_items')
        .update({ is_resolved: false, resolved_at: null })
        .eq('id', String(id));

    if (error) throw error;
};

export const deleteBackorderedItem = async (id: string) => {
    const { error } = await supabase
        .from('backordered_items')
        .delete()
        .eq('id', String(id));

    if (error) throw error;
};

// --- Verification Status ---

// --- Archived Orders ---

export const getArchivedOrders = async (): Promise<SavedOrder[]> => {
    const { data, error } = await supabase
        .from('saved_orders')
        .select('*')
        .not('archived_date', 'is', null);

    if (error) throw error;

    return data?.map((item: any) => ({
        ...item.data_json,
        id: item.id,
        archivedDate: item.archived_date
    })) || [];
};

// --- Estampas (Print Control) ---

export const getEstampasStatus = async (): Promise<Record<string, Partial<EstampaRow>>> => {
    // Calculamos a data de corte (30 dias atrás)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutOffDate = thirtyDaysAgo.toISOString();

    const { data, error } = await supabase
        .from('print_control')
        .select('*')
        // Filtro Inteligente: Não traz pedidos IMPRESSO ou ENTREGUE se forem mais velhos que 60 dias
        // Isso mantém a tela de Estampas leve para sempre.
        .or(`status.not.in.(IMPRESSO,ENTREGUE,ENVIADO),updated_at.gt.${cutOffDate}`)
        .order('updated_at', { ascending: false })
        .limit(10000);
    if (error) throw error;

    const statusMap: Record<string, Partial<EstampaRow>> = {};
    data?.forEach((item: any) => {
        // Construct the key as orderId-itemId or just orderId if itemId is null
        // The frontend uses orderId as key in most cases, or a composite key.
        // Looking at App.tsx, estampasStatus is Record<string, Partial<EstampaRow>>.
        // The key seems to be the order ID (codVenda).
        statusMap[item.order_id] = {
            status: item.status,
            localEstampa: item.local_estampa,
            observacao: item.observacao,
            dataPrevista: item.data_prevista,
            googleDriveFolderId: item.google_drive_folder_id,
            googleDriveImages: item.google_drive_images,
            nomeEstampa: item.nome_estampa,
            tratado: item.tratado,
            cor: item.cor,
            tamanho: item.tamanho,
            data: item.data,
            L: item.l,
            aramadoLetra: item.aramado_letra,
            aramadoNumero: item.aramado_numero,
            rastreio: item.rastreio,
            linkPedido: item.link_pedido,
            arteProntaId: item.arte_pronta_id,
            aramadoDataColocacao: item.aramado_data_colocacao,
            aramadoDataRetirada: item.aramado_data_retirada,
            updatedAt: item.updated_at
        };
    });
    return statusMap;
};

// Helper to clean partial payloads (omit undefined values to prevent Supabase from overwriting with NULL or failing)
const cleanEstampaPayload = (orderId: string, status: Partial<EstampaRow>) => {
    const payload: any = { order_id: orderId };

    const mapping: Record<string, keyof EstampaRow> = {
        status: 'status',
        local_estampa: 'localEstampa',
        observacao: 'observacao',
        // NOTE: 'dataPrevista' field is intentionally REMOVED from mapping
        // The frontend uses 'dataPrevista' as a short format (DD/MM) for display only,
        // but Supabase expects a full timestamp. We don't need to persist this field.
        google_drive_folder_id: 'googleDriveFolderId',
        google_drive_images: 'googleDriveImages',
        nome_estampa: 'nomeEstampa',
        tratado: 'tratado',
        cor: 'cor',
        tamanho: 'tamanho',
        // NOTE: 'data' field is intentionally REMOVED from mapping
        // The frontend uses 'data' as a short format (DD/MM) for display only,
        // but Supabase expects a full timestamp. We don't need to persist this field.
        l: 'L',
        aramado_letra: 'aramadoLetra',
        aramado_numero: 'aramadoNumero',
        rastreio: 'rastreio',
        link_pedido: 'linkPedido',
        arte_pronta_id: 'arteProntaId',
        aramado_data_colocacao: 'aramadoDataColocacao',
        aramado_data_retirada: 'aramadoDataRetirada'
    };

    Object.entries(mapping).forEach(([dbKey, rowKey]) => {
        const value = status[rowKey];
        // 🔴 CRITICAL FIX: Ignore both undefined AND empty strings
        // Empty strings would overwrite existing data in the database
        if (value !== undefined && value !== '') {
            payload[dbKey] = value;
        }
    });

    console.log('[cleanEstampaPayload] 🧹 Original fields:', Object.keys(status).length);
    console.log('[cleanEstampaPayload] ✅ Cleaned fields:', Object.keys(payload).length - 1); // -1 for order_id

    return payload;
};

export const saveEstampasStatus = async (orderId: string, status: Partial<EstampaRow>) => {
    const payload = cleanEstampaPayload(orderId, status);
    const { error } = await supabase
        .from('print_control')
        .upsert(payload, { onConflict: 'order_id' });

    if (error) throw error;
};

export const saveBulkEstampasStatus = async (updates: { orderId: string, status: Partial<EstampaRow> }[]) => {
    if (updates.length === 0) {
        console.log('[saveBulkEstampasStatus] Nenhuma atualização para processar');
        return;
    }

    console.log(`[saveBulkEstampasStatus] Processando ${updates.length} atualizações`);
    const payloads = updates.map(u => {
        const payload = cleanEstampaPayload(u.orderId, u.status);
        console.log(`[saveBulkEstampasStatus] Payload para ${u.orderId}:`, payload);
        return payload;
    });

    console.log('[saveBulkEstampasStatus] Enviando para Supabase...');
    const { data, error } = await supabase
        .from('print_control')
        .upsert(payloads, { onConflict: 'order_id' })
        .select(); // Adicionado .select() para retornar os dados inseridos (útil para debug)

    if (error) {
        console.error('[saveBulkEstampasStatus] ❌ ERRO:', error);
        console.error('[saveBulkEstampasStatus] Código:', error.code);
        console.error('[saveBulkEstampasStatus] Mensagem:', error.message);
        console.error('[saveBulkEstampasStatus] Detalhes:', error.details);
        throw error;
    }

    console.log(`[saveBulkEstampasStatus] ✅ Sucesso! ${data?.length || 0} registros afetados`);
};

// --- Verification Status ---

export const getVerificationStatus = async (): Promise<Record<string, VerificationStatus>> => {
    const { data, error } = await supabase.from('verification_status').select('*');
    if (error) throw error;

    const statusMap: Record<string, VerificationStatus> = {};
    data?.forEach((item: any) => {
        statusMap[item.order_id] = item.status_json;
    });
    return statusMap;
};

export const saveVerificationStatus = async (orderId: string, status: VerificationStatus) => {
    const { error } = await supabase
        .from('verification_status')
        .upsert({
            order_id: orderId,
            status_json: status
        });

    if (error) throw error;
};

// --- Tracking Mappings ---

export const getTrackingMappings = async (): Promise<Record<string, string>> => {
    const { data, error } = await supabase.from('tracking_mappings').select('*');
    if (error) throw error;

    const mappings: Record<string, string> = {};
    data?.forEach((item: any) => {
        mappings[item.order_id] = item.tracking_code;
    });
    return mappings;
};

export const saveTrackingMapping = async (orderId: string, trackingCode: string) => {
    const { error } = await supabase
        .from('tracking_mappings')
        .upsert({
            order_id: orderId,
            tracking_code: trackingCode
        }, { onConflict: 'order_id' });

    if (error) throw error;
};

// --- Stores ---

export const getStores = async (): Promise<Store[]> => {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) throw error;
    return data || [];
};

export const saveStore = async (store: Store) => {
    const { error } = await supabase
        .from('stores')
        .upsert({
            name: store.name,
            types: store.types
        }, { onConflict: 'name' });

    if (error) throw error;
};

export const deleteStore = async (name: string) => {
    const { error } = await supabase.from('stores').delete().eq('name', name);
    if (error) throw error;
};

// --- App Settings ---

export const getSetting = async (key: string): Promise<string | null> => {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
    }
    return data?.value || null;
};

export const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({
            key,
            value,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) throw error;
};

// --- Spreadsheet Data Persistence ---

export interface SpreadsheetDataRow {
    filename: string;
    importDate: string;
    rowData: any; // TableRow type
}

export const saveSpreadsheetData = async (filename: string, rows: any[], importDate: string) => {
    // Delete existing data for this filename first
    await supabase
        .from('spreadsheet_data')
        .delete()
        .eq('filename', filename);

    // Insert new data - batch insert all rows
    const dataToInsert = rows.map(row => ({
        filename,
        import_date: importDate,
        row_data: row
    }));

    const { error } = await supabase
        .from('spreadsheet_data')
        .insert(dataToInsert);

    if (error) throw error;
};

export const syncOrderStatuses = async (ids: string[]): Promise<{ id: string, status: string, unifiedStatus: string }[]> => {
    if (!ids || ids.length === 0) return [];

    // Use RPC or raw query if possible, but standard selection is fine for < 100 items
    // Since we need to extract from JSONB, the syntax is:
    // row_data ->> 'situacao'

    // Note: We need to chunk if too many IDs (Supabase URL limit)
    const chunks = [];
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
    }

    const results: { id: string, status: string, unifiedStatus: string }[] = [];

    for (const chunk of chunks) {
        const { data, error } = await supabase
            .from('spreadsheet_data')
            .select('id, row_data')
            .in('id', chunk); // Filter by row ID (Supabase ID)

        if (error) {
            console.error('[syncOrderStatuses] Error fetching statuses:', error);
            continue;
        }

        if (data) {
            data.forEach((row: any) => {
                const situacao = row.row_data?.situacao || row.row_data?.["Situação"] || '';
                const situacaoLower = situacao.toLowerCase();
                let unified = 'Pendente';

                // Mimic the unified logic
                if (['faturado', 'em aberto', 'aprovado', 'preparando envio'].some(s => situacaoLower.includes(s))) {
                    unified = 'Aprovado';
                }

                results.push({
                    id: row.id,
                    status: situacao,
                    unifiedStatus: unified
                });
            });
        }
    }

    return results;
};

export const getSpreadsheetData = async (): Promise<Record<string, { rows: any[], importDate: string }>> => {
    let allData: any[] = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    // OPTIMIZATION: Filter only last 15 days of imports to balance performance and history
    // UPDATED: Reduced from 60 to 15 days to prevent 'exceed_egress_quota' errors
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 15);
    const cutOffDate = sixtyDaysAgo.toISOString();

    while (hasMore) {
        const { data, error } = await supabase
            .from('spreadsheet_data')
            .select('id, filename, import_date, row_data')
            .gt('import_date', cutOffDate) // Only load recent data
            .order('import_date', { ascending: false })
            .range(from, to);

        if (error) throw error;

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allData = [...allData, ...data];
            // If we got less than 1000 rows, it's the last page
            if (data.length < 1000) {
                hasMore = false;
            } else {
                from += 1000;
                to += 1000;
            }
        }
    }

    // Helper to normalize keys to lowercase and map legacy keys
    const normalizeKeys = (row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase();
            newRow[lowerKey] = row[key];

            // Explicit Mappings for mismatches
            if (lowerKey === 'situação') newRow['situacao'] = row[key];
            if (lowerKey === 'identificador do pedido e-commerce' || lowerKey === 'numero da ordem de compra') {
                newRow['id'] = row[key];
            }
        });
        return newRow;
    };

    // Group by filename
    const grouped: Record<string, { rows: any[], importDate: string }> = {};

    allData.forEach((item: any) => {
        if (!grouped[item.filename]) {
            grouped[item.filename] = {
                rows: [],
                importDate: item.import_date
            };
        }
        // Inject Supabase ID for updates AND Normalize keys
        grouped[item.filename].rows.push({
            ...normalizeKeys(item.row_data),
            _supabaseId: item.id
        });
    });

    return grouped;
};

export const deleteSpreadsheetFile = async (filename: string) => {
    const { error } = await supabase
        .from('spreadsheet_data')
        .delete()
        .eq('filename', filename);

    if (error) throw error;
};

export const clearAllSpreadsheetData = async () => {
    const { error } = await supabase
        .from('spreadsheet_data')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

    if (error) throw error;
};

export const deleteManualSpreadsheetData = async () => {
    const { error } = await supabase
        .from('spreadsheet_data')
        .delete()
        .neq('filename', 'Tiny ERP Auto-Import');

    if (error) throw error;
};

// --- Real-Time Subscriptions ---

export interface SpreadsheetChangePayload {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: any;
    old: any;
}

export const subscribeToSpreadsheetChanges = (
    callback: (payload: SpreadsheetChangePayload) => void
) => {
    const channel = supabase
        .channel('spreadsheet_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'spreadsheet_data'
            },
            (payload: any) => {
                callback({
                    eventType: payload.eventType,
                    new: payload.new,
                    old: payload.old
                });
            }
        )
        .subscribe();

    return channel;
};


export const subscribeToQueueChanges = (
    callback: (payload: any) => void
) => {
    const channel = supabase
        .channel('queue_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'webhook_retry_queue'
            },
            (payload: any) => {
                callback(payload);
            }
        )
        .subscribe();

    return channel;
};

export const subscribeToSavedOrders = (
    callback: (payload: any) => void
) => {
    const channel = supabase
        .channel('saved_orders_realtime')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'saved_orders'
            },
            (payload: any) => {
                callback(payload);
            }
        )
        .subscribe();

    return channel;
};

export const subscribeToVerificationStatus = (
    callback: (payload: any) => void
) => {
    const channel = supabase
        .channel('verification_status_realtime')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'verification_status'
            },
            (payload: any) => {
                callback(payload);
            }
        )
        .subscribe();

    return channel;
};

export const insertSpreadsheetRow = async (filename: string, rowData: any): Promise<string | number> => {
    const { data, error } = await supabase
        .from('spreadsheet_data')
        .insert({
            filename,
            import_date: new Date().toISOString(),
            row_data: rowData
        })
        .select('id')
        .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to insert row');

    return data.id;
};

export const updateSpreadsheetRow = async (id: string | number, fieldsToUpdate: any) => {
    // First, get the current row_data
    const { data: currentRow, error: fetchError } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .eq('id', String(id))
        .single();

    if (fetchError) throw fetchError;
    if (!currentRow) throw new Error('Row not found');

    // Merge the fields
    const updatedRowData = { ...currentRow.row_data, ...fieldsToUpdate };

    // Update with merged data
    const { error } = await supabase
        .from('spreadsheet_data')
        .update({ row_data: updatedRowData })
        .eq('id', String(id));

    if (error) throw error;
};

export const deleteSpreadsheetRow = async (id: string | number) => {
    const { error } = await supabase
        .from('spreadsheet_data')
        .delete()
        .eq('id', String(id));

    if (error) throw error;
};

// --- Lotes (Batch Management) ---

export const getLotes = async (): Promise<import('../Dashboard/types').Lote[]> => {
    const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .order('data_criacao', { ascending: false });

    if (error) throw error;

    return data?.map((item: any) => ({
        id: item.id,
        numeroLote: item.numero_lote,
        imagemUrl: item.imagem_url,
        imagens: item.imagens, // Array of all images
        dataCriacao: item.data_criacao,
        thumbnail: item.thumbnail
    })) || [];
};

export const saveLote = async (lote: Omit<import('../Dashboard/types').Lote, 'id'> & { thumbnail?: string }): Promise<import('../Dashboard/types').Lote> => {
    const { data, error } = await supabase
        .from('lotes')
        .insert({
            numero_lote: lote.numeroLote,
            imagem_url: lote.imagemUrl,
            imagens: lote.imagens,
            data_criacao: lote.dataCriacao,
            thumbnail: lote.thumbnail
        })
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        numeroLote: data.numero_lote,
        imagemUrl: data.imagem_url,
        imagens: data.imagens,
        dataCriacao: data.data_criacao,
        thumbnail: data.thumbnail
    };
};

export const updateLote = async (loteId: string, updates: Partial<Omit<import('../Dashboard/types').Lote, 'id' | 'dataCriacao'>>): Promise<void> => {
    const updateData: any = {};

    if (updates.numeroLote !== undefined) {
        updateData.numero_lote = updates.numeroLote;
    }

    if (updates.imagemUrl !== undefined) {
        updateData.imagem_url = updates.imagemUrl;
    }

    if (updates.imagens !== undefined) {
        updateData.imagens = updates.imagens;
    }

    if (updates.thumbnail !== undefined) {
        updateData.thumbnail = updates.thumbnail;
    }

    const { error } = await supabase
        .from('lotes')
        .update(updateData)
        .eq('id', loteId);

    if (error) {
        console.error('[updateLote] Error:', error);
        throw error;
    }
};

export const deleteLote = async (id: string): Promise<void> => {
    // First, get the lote to delete its image from Google Drive
    const { data: lote } = await supabase
        .from('lotes')
        .select('imagem_url, numero_lote')
        .eq('id', id)
        .single();

    if (lote?.imagem_url) {
        // Delete image from Google Drive
        try {
            await deleteLoteImage(lote.imagem_url);
        } catch (e) {
            console.error('Error deleting lote image from Google Drive:', e);
        }
    }

    // Delete the database record
    const { error } = await supabase
        .from('lotes')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const deleteLoteImage = async (imagemUrl: string): Promise<void> => {
    if (!imagemUrl) return;

    // Extrair ID do Drive da URL
    // URL format: https://drive.google.com/uc?id=FILE_ID
    const match = imagemUrl.match(/[?&]id=([^&]+)/);
    if (!match) {
        console.warn('URL do Google Drive inválida:', imagemUrl);
        return;
    }

    const fileId = match[1];

    try {
        // Import dynamically to avoid circular dependencies
        const { gapi } = await import('gapi-script');
        const { initGapi } = await import('./googleDriveService');

        await initGapi();
        await gapi.client.drive.files.delete({
            fileId: fileId,
            supportsAllDrives: true
        });
        console.log(`[Drive] Imagem de lote deletada: ${fileId}`);
    } catch (error) {
        console.error('[Drive] Erro ao deletar imagem:', error);
        throw new Error('Falha ao deletar imagem do Google Drive');
    }
};

// Helper to get file extension
const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '.jpg';
};

export const uploadLoteImage = async (file: File, numeroLote: string): Promise<{ imageUrl: string, thumbnailUrl?: string }> => {
    // Import Google Drive functions dynamically to avoid circular imports
    const { findOrCreateFolder, uploadFileToDrive, isUserAuthenticated, handleSignIn } = await import('./googleDriveService');

    // 1. Verificar autenticação
    if (!isUserAuthenticated()) {
        const success = await handleSignIn();
        if (!success) {
            throw new Error('Falha na autenticação com Google Drive');
        }
    }

    // 2. Pegar root folder
    const mainRootId = localStorage.getItem('googleDrivePublicFolderId') || '1lPRLR2oHxhPrkg4etlNyeTawZvDBZxk';

    // 3. Criar ou encontrar pasta "Lotes"
    const lotesFolderId = await findOrCreateFolder('Lotes', mainRootId);

    // 4. Upload do arquivo com nome do lote
    const fileName = `${numeroLote}${getFileExtension(file.name)}`;
    const uploadedFile = await uploadFileToDrive(
        new File([file], fileName, { type: file.type }),
        lotesFolderId
    );

    // 5. Tornar o arquivo público
    await makeFilePublic(uploadedFile.id);

    // 6. Retornar URL pública para visualização em ALTA QUALIDADE
    // Usar webContentLink que funciona para arquivos públicos
    const highQualityUrl = uploadedFile.webViewLink?.replace('/view', '/preview') ||
        `https://drive.google.com/file/d/${uploadedFile.id}/preview`;

    return {
        imageUrl: highQualityUrl, // URL de visualização em alta qualidade
        thumbnailUrl: uploadedFile.thumbnailLink // URL de baixa qualidade para thumbnails
    };
};

/**
 * Torna um arquivo do Google Drive público (leitura para qualquer pessoa)
 */
const makeFilePublic = async (fileId: string): Promise<void> => {
    const { getAccessToken } = await import('./googleDriveService');
    const token = getAccessToken();

    if (!token) {
        throw new Error('Token de acesso não disponível');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
        })
    });

    if (!response.ok) {
        console.error('Falha ao tornar arquivo público:', await response.text());
        throw new Error('Falha ao configurar permissões do arquivo');
    }
};

// --- Lote-Pedido Linking ---

/**
 * Get pedidos (estampas) that don't have a lote assigned yet
 */
export const getPedidosSemLote = async (): Promise<{ order_id: string, nome_estampa: string, cor: string, tamanho: string }[]> => {
    const { data, error } = await supabase
        .from('print_control')
        .select('order_id, nome_estampa, cor, tamanho, status')
        .or('l.is.null,l.eq.')  // L is null or empty string
        .neq('status', 'CANCELADO')  // Exclude cancelled orders
        .order('order_id', { ascending: true })
        .limit(100);  // Limit for performance

    if (error) throw error;
    return data || [];
};

/**
 * Assign a lote to a pedido by updating its column L
 */
export const assignLoteToPedido = async (orderId: string, numeroLote: string): Promise<void> => {
    await saveEstampasStatus(orderId, { L: numeroLote });
};

/**
 * Get all pedidos that have a specific lote assigned
 */
export const getPedidosByLote = async (numeroLote: string): Promise<{ order_id: string, nome_estampa: string, cor: string, tamanho: string }[]> => {
    const { data, error } = await supabase
        .from('print_control')
        .select('order_id, nome_estampa, cor, tamanho, status')
        .eq('l', numeroLote)
        .order('order_id', { ascending: true });

    if (error) throw error;
    return data || [];
};

/**
 * Validate if a lote number exists in the lotes table
 */
export const validateLoteExists = async (numeroLote: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('lotes')
        .select('id')
        .eq('numero_lote', numeroLote)
        .limit(1);

    if (error) {
        console.error('[validateLoteExists] Error:', error);
        return false;
    }

    return (data && data.length > 0);
};

/**
 * Get lote summary including pedido count and status breakdown
 */
export const getLoteSummary = async (numeroLote: string): Promise<{
    lote: import('../Dashboard/types').Lote | null,
    pedidoCount: number,
    statusBreakdown: Record<string, number>
}> => {
    // Get the lote details
    const { data: loteData, error: loteError } = await supabase
        .from('lotes')
        .select('*')
        .eq('numero_lote', numeroLote)
        .single();

    if (loteError && loteError.code !== 'PGRST116') {
        console.error('[getLoteSummary] Error fetching lote:', loteError);
        throw loteError;
    }

    const lote = loteData ? {
        id: loteData.id,
        numeroLote: loteData.numero_lote,
        imagemUrl: loteData.imagem_url,
        dataCriacao: loteData.data_criacao,
        thumbnail: loteData.thumbnail
    } : null;

    // Get pedidos for this lote
    const { data: pedidosData, error: pedidosError } = await supabase
        .from('print_control')
        .select('status')
        .eq('l', numeroLote);

    if (pedidosError) {
        console.error('[getLoteSummary] Error fetching pedidos:', pedidosError);
        throw pedidosError;
    }

    // Calculate statistics
    const statusBreakdown: Record<string, number> = {};
    pedidosData?.forEach((pedido: any) => {
        const status = pedido.status || 'SEM STATUS';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    return {
        lote,
        pedidoCount: pedidosData?.length || 0,
        statusBreakdown
    };
};

/**
 * Bulk assign multiple pedidos to a single lote
 */
export const bulkAssignLoteToPedidos = async (orderIds: string[], numeroLote: string): Promise<void> => {
    if (orderIds.length === 0) {
        console.warn('[bulkAssignLoteToPedidos] No order IDs provided');
        return;
    }

    console.log(`[bulkAssignLoteToPedidos] Assigning ${orderIds.length} pedidos to lote ${numeroLote}`);

    const updates = orderIds.map(orderId => ({
        order_id: orderId,
        l: numeroLote,
        aramado_data_colocacao: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')
    }));

    const { error } = await supabase
        .from('print_control')
        .upsert(updates, { onConflict: 'order_id' });

    if (error) {
        console.error('[bulkAssignLoteToPedidos] Error:', error);
        throw error;
    }

    console.log(`[bulkAssignLoteToPedidos] Successfully assigned ${orderIds.length} pedidos to lote ${numeroLote}`);
};

export const subscribeToBackorderedItems = (callback: () => void) => {
    return supabase
        .channel('backordered_items_watcher')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'backordered_items' },
            () => callback()
        )
        .subscribe();
};


