import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Support for dual tokens (MM + MVF) or single token (backward compat)
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM || process.env.TINY_API_TOKEN;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF;

// Company configuration
const COMPANIES = [
    {
        name: 'MM',
        cnpj: '39447291000104',
        token: TINY_TOKEN_MM,
        enabled: !!TINY_TOKEN_MM
    },
    {
        name: 'MVF',
        cnpj: '25116514000138',
        token: TINY_TOKEN_MVF,
        enabled: !!TINY_TOKEN_MVF
    }
];

// Helper to convert DD/MM/YYYY to Date object
function convertToDate(dateStr: string): Date {
    if (!dateStr) return new Date(0); // Old date for missing dates
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(0);
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
}

// Sync recent orders from Tiny API for a specific company (Discovery Mode)
async function syncCompanyOrders(company: typeof COMPANIES[0], daysBack: number = 15, maxOrders?: number, forceReprocess: boolean = false) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log(`\n🔍 Looking for orders from ${company.name} (last ${daysBack} days)...`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const formatDate = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const dataInicial = formatDate(startDate);
    const dataFinal = formatDate(endDate);

    let page = 1;
    let hasMore = true;
    let totalFound = 0;
    let addedToQueue = 0;
    let alreadyKnown = 0;

    try {
        while (hasMore) {
            const response = await fetch(
                `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${company.token}&formato=JSON&dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=${page}`
            );

            const data = await response.json();

            if (!data.retorno || (data.retorno.status !== 'OK' && data.retorno.status !== 'Erro')) {
                if (data.retorno?.codigo_erro === '20') {
                    hasMore = false;
                    break;
                }
                console.error(`${company.name} Tiny API Error on page ${page}:`, data);
                hasMore = false;
                break;
            }

            const orders = data.retorno.pedidos || [];
            if (orders.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`📦 Page ${page}: Found ${orders.length} orders from ${company.name}`);
            totalFound += orders.length;

            // OPTIMIZED: Collect all order IDs from this page first
            const pageOrderIds: string[] = [];
            const validOrders: any[] = [];

            for (const orderWrapper of orders) {
                const order = orderWrapper.pedido;
                const orderId = String(order.id || order.numero);
                const orderDate = order.data_pedido || ''; // DD/MM/YYYY format

                pageOrderIds.push(orderId);
                validOrders.push({ order, orderId, orderDate });
            }


            if (pageOrderIds.length === 0) {
                if (orders.length < 100) {
                    hasMore = false;
                } else {
                    page++;
                    await new Promise(r => setTimeout(r, 500));
                }
                continue;
            }

            // 🔍 CHECK DELETED ORDERS: Filter out IDs present in deleted_orders table
            // This prevents "Ghost Orders" from reappearing after deletion
            const { data: deletedOrders } = await supabase
                .from('deleted_orders')
                .select('order_id')
                .in('order_id', pageOrderIds);

            const deletedIdsSet = new Set(deletedOrders?.map(d => d.order_id) || []);

            // OPTIMIZATION: Filter out deleted orders BEFORE processing
            const nonDeletedPageOrderIds = pageOrderIds.filter(id => !deletedIdsSet.has(id));

            if (nonDeletedPageOrderIds.length === 0) {
                // All orders in this page are deleted, skip page processing
                console.log(`  ⏩ Skipping page ${page} - All ${pageOrderIds.length} orders are in deleted_orders blacklist.`);
                if (orders.length < 100) hasMore = false;
                else { page++; await new Promise(r => setTimeout(r, 500)); }
                continue;
            }

            // BATCH CHECK 1: Check ONLY non-deleted IDs in spreadsheet_data
            const { data: existingInData, error: existingError } = await supabase
                .from('spreadsheet_data')
                .select('row_data')
                .in('row_data->>ID Tiny', nonDeletedPageOrderIds);

            if (existingError) {
                console.error(`  ❌ Failed to check existing orders on page ${page}:`, existingError);
                // Fail safety: If we can't verify existence, we should probably SKIP this page or Retry,
                // rather than assuming they don't exist and re-queuing duplicates.
                // For now, let's treat it as a hard error to stop the bleeding.
                throw new Error(`DB Check Failed: ${existingError.message}`);
            }

            // BATCH CHECK 1.5: Check ONLY non-deleted IDs in saved_orders (The main database)
            // This prevents re-queueing orders that are already fully processed and saved.
            const { data: savedOrdersData, error: savedOrdersError } = await supabase
                .from('saved_orders')
                .select('id, data_json')
                .in('id', nonDeletedPageOrderIds);

            if (savedOrdersError) {
                console.error(`  ❌ Failed to check saved orders on page ${page}:`, savedOrdersError);
                // Continue cautiously or throw? Let's log and continue, assuming they might need update.
            }

            // Map: ID -> Normalized Status
            const dbStatusMap = new Map<string, string>();

            // 1. Fill from Spreadsheet Data (Legacy)
            existingInData?.forEach((r: any) => {
                const id = String(r.row_data['ID Tiny'] || r.row_data['id_tiny'] || '');
                const status = String(r.row_data['Situação'] || r.row_data['status'] || '').toLowerCase().trim();
                if (id) dbStatusMap.set(id, status);
            });

            // 2. Fill from Saved Orders (Modern/Current) - Overwrites legacy if exists (which is good)
            savedOrdersData?.forEach((r: any) => {
                const id = String(r.id || '');
                // saved_orders stores status in data_json.status
                const status = String(r.data_json?.status || '').toLowerCase().trim();
                if (id) dbStatusMap.set(id, status);
            });

            const knownInData = new Set(dbStatusMap.keys());

            // BATCH CHECK 2: Check ONLY non-deleted IDs in retry queue
            const { data: existingInQueue } = await supabase
                .from('webhook_retry_queue')
                .select('order_id, status')
                .in('order_id', nonDeletedPageOrderIds);

            const queueStatusMap = new Map<string, string>();
            existingInQueue?.forEach((r: any) => {
                queueStatusMap.set(r.order_id, r.status);
            });

            // Sort by date DESC (Newest First)
            validOrders.sort((a, b) => {
                const dateA = convertToDate(a.orderDate);
                const dateB = convertToDate(b.orderDate);
                return dateB.getTime() - dateA.getTime(); // DESC
            });

            const newOrdersToInsert = [];
            const idsToReset = [];

            for (const { order, orderId, orderDate } of validOrders) {
                // Check queue status
                if (queueStatusMap.has(orderId)) {
                    const status = queueStatusMap.get(orderId);

                    // If forceReprocess is true, we want to re-examine the order even if it was previously completed or failed.
                    // This allows status updates for existing orders.
                    if (forceReprocess && (status === 'completed' || status === 'failed' || status === 'error')) {
                        idsToReset.push(orderId);
                        alreadyKnown++;
                    } else {
                        alreadyKnown++;
                    }
                    continue;
                }

                // SMART SYNC LOGIC:
                // Check if in spreadsheet_data AND status matches
                if (dbStatusMap.has(orderId)) {
                    const dbStatus = dbStatusMap.get(orderId);
                    const apiStatus = String(order.situacao || '').toLowerCase().trim();

                    // If status is identical, we SKIP updating to save resources
                    // regardless of forceReprocess (unless user explicitly wants to fix OTHER data fields, 
                    // but for "Atualizar 7 dias" usually status is the goal)
                    if (dbStatus === apiStatus) {
                        // console.log(`  ⏩ Skipping ${orderId} - Status identical (${apiStatus})`);
                        alreadyKnown++;
                        continue;
                    }

                    console.log(`  🔄 Status Changed for ${orderId}: "${dbStatus}" -> "${apiStatus}". Quewing update.`);
                    // If status different, we fall through to add to queue!
                }

                newOrdersToInsert.push({
                    order_id: orderId,
                    company: company.name,
                    status: 'pending',
                    retry_count: 0,
                    max_retries: 5,
                    next_retry_at: new Date().toISOString(),
                    order_date: orderDate, // Store for priority processing
                    payload: { cnpj: company.cnpj, origin: 'Sync Discovery' }
                });

                if (maxOrders && (addedToQueue + alreadyKnown + newOrdersToInsert.length) >= maxOrders) {
                    hasMore = false;
                    break;
                }
            }

            // Batch Reset Failed Orders
            if (idsToReset.length > 0) {
                await supabase
                    .from('webhook_retry_queue')
                    .update({
                        status: 'pending',
                        retry_count: 0,
                        next_retry_at: new Date().toISOString(),
                        last_error: null
                    })
                    .in('order_id', idsToReset);
                console.log(`   🔄 Reset ${idsToReset.length} failed orders to pending`);
            }

            // Batch insert all new orders at once
            if (newOrdersToInsert.length > 0) {
                const { error: queueError } = await supabase
                    .from('webhook_retry_queue')
                    .insert(newOrdersToInsert);

                if (!queueError) {
                    addedToQueue += newOrdersToInsert.length;
                    console.log(`   ✅ Added ${newOrdersToInsert.length} new orders to queue`);
                } else {
                    console.error(`Error batch inserting to queue:`, queueError);
                    throw new Error(`Failed to add orders to queue: ${queueError.message}`);
                }
            }


            if (orders.length < 100 || (maxOrders && (totalFound >= maxOrders))) {
                hasMore = false;
            } else {
                page++;
                // 1s delay per page to respect 60 RPM
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        return {
            success: true,
            company: company.name,
            stats: {
                total: totalFound,
                added: addedToQueue,
                known: alreadyKnown,
                imported: addedToQueue // compatibility
            }
        };

    } catch (error: any) {
        console.error(`${company.name} discovery failed:`, error);
        return { success: false, company: company.name, error: error.message };
    }
}

// Sync all enabled companies
async function syncAllCompanies(daysBack: number = 7, maxOrders?: number, forceReprocess: boolean = false) {
    const enabledCompanies = COMPANIES.filter(c => c.enabled);

    if (enabledCompanies.length === 0) {
        return {
            success: false,
            error: 'No Tiny API tokens configured. Set TINY_API_TOKEN_MM and/or TINY_API_TOKEN_MVF'
        };
    }

    // Sync all enabled companies in parallel
    const results = await Promise.all(enabledCompanies.map(company => syncCompanyOrders(company, daysBack, maxOrders, forceReprocess)));

    const allSuccess = results.every(r => r.success);
    const totalStats = results.reduce((acc, r) => ({
        total: acc.total + (r.stats?.total || 0),
        added: acc.added + (r.stats?.added || 0),
        known: acc.known + (r.stats?.known || 0),
        imported: acc.imported + (r.stats?.imported || 0) // compatibility
    }), { total: 0, added: 0, known: 0, imported: 0 });

    return {
        success: allSuccess,
        results,
        totalStats
    };
}

// API Handler
export default async function handler(req: any, res: any) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST' || req.method === 'GET') {
        try {
            // OPTIMIZATION: Enforce max 30 days to prevent overloading
            let daysBack = req.method === 'POST' ? (req.body?.daysBack || 30) : 7;
            daysBack = Math.min(daysBack, 90); // Hard limit 90 days
            const maxOrders = req.method === 'POST' ? req.body?.maxOrders : undefined;
            // Force reprocess only if explicitly requested
            const forceReprocess = req.method === 'POST' ? (req.body?.forceReprocess === true) : false;

            console.log(`🚀 Starting Tiny Discovery (${daysBack} days, maxOrders: ${maxOrders || 'unlimited'}, force: ${forceReprocess})...`);

            const result = await syncAllCompanies(daysBack, maxOrders, forceReprocess);

            if (result.success) {
                return res.status(200).json({
                    success: true,
                    message: 'Discovery completed. Orders added to queue.',
                    stats: result.totalStats,
                    details: result.results
                });
            } else {
                return res.status(500).json({
                    success: false,
                    error: result.error || 'Some discovery syncs failed',
                    details: result.results
                });
            }

        } catch (error: any) {
            console.error('Sync failed:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
