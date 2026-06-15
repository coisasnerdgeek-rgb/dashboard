
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// --- Manual .env.local reader START ---
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
try {
    envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
    console.error('❌ Could not read .env.local');
    process.exit(1);
}

const vars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, ...valParts] = line.split('=');
    if (key && valParts.length > 0) {
        vars[key.trim()] = valParts.join('=').trim();
    }
});

const SUPABASE_URL = vars['SUPABASE_URL'] || vars['VITE_SUPABASE_URL'];
const SUPABASE_KEY = vars['SUPABASE_SERVICE_ROLE_KEY'] || vars['VITE_SUPABASE_SERVICE_ROLE_KEY'];
const TINY_TOKEN_MM = vars['TINY_API_TOKEN_MM'] || vars['TINY_API_TOKEN'];
const TINY_TOKEN_MVF = vars['TINY_API_TOKEN_MVF'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}
// --- Manual .env.local reader END ---

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

function convertToDate(dateStr: string): Date {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(0);
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
}

async function syncCompanyOrders(company: any, daysBack: number = 7, maxOrders?: number, forceReprocess: boolean = false) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log(`\n🔍 Looking for orders from ${company.name} (last ${daysBack} days)...`);

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

    try {
        while (hasMore) {
            const url = `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${company.token}&formato=JSON&dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=${page}`;
            console.log(`📡 Fetching Page ${page}: ${url.replace(company.token, '***')}`);

            const response = await fetch(url);
            const data: any = await response.json();

            if (!data.retorno || (data.retorno.status !== 'OK' && data.retorno.status !== 'Erro')) {
                if (data.retorno?.codigo_erro === '20') {
                    console.log('✅ End of Pages (Error 20)');
                    hasMore = false;
                    break;
                }
                console.error('❌ API Error:', data);
                hasMore = false;
                break;
            }

            const orders = data.retorno.pedidos || [];
            if (orders.length === 0) {
                console.log('✅ End of Pages (0 orders)');
                hasMore = false;
                break;
            }

            console.log(`📦 Page ${page}: Found ${orders.length} orders.`);

            const pageOrderIds: string[] = [];
            const validOrders: any[] = [];

            for (const orderWrapper of orders) {
                const order = orderWrapper.pedido;
                const orderId = String(order.id || order.numero);
                pageOrderIds.push(orderId);
                validOrders.push({ order, orderId, orderDate: order.data_pedido });
            }

            // DEBUG: Print first 3 IDs
            console.log(`👀 First 3 IDs in this page: ${pageOrderIds.slice(0, 3).join(', ')}`);

            // --- DELETED CHECK ---
            const { data: deletedOrders } = await supabase
                .from('deleted_orders')
                .select('order_id')
                .in('order_id', pageOrderIds);
            const deletedIdsSet = new Set(deletedOrders?.map(d => d.order_id) || []);
            const nonDeletedPageOrderIds = pageOrderIds.filter(id => !deletedIdsSet.has(id));

            if (nonDeletedPageOrderIds.length === 0) {
                console.log('⏩ All deleted.');
                page++; continue;
            }

            // --- BATCH CHECK (THE BUG SUSPECT) ---
            console.log(`🧪 querying .in('row_data->>ID Tiny', [${nonDeletedPageOrderIds.length} IDs])`);

            const { data: existingInData, error: checkError } = await supabase
                .from('spreadsheet_data')
                .select('row_data')
                .in('row_data->>ID Tiny', nonDeletedPageOrderIds);

            if (checkError) {
                console.error('❌ Check Failed:', checkError);
            } else {
                console.log(`📊 Found ${existingInData?.length} matches in DB.`);
                if (existingInData?.length === 0) {
                    console.log('⚠️  WARNING: 0 MATCHES FOUND! This implies all these orders are considered NEW or the query is failing.');
                }
            }

            // Map Check
            const dbStatusMap = new Map<string, string>();
            existingInData?.forEach((r: any) => {
                const id = String(r.row_data['ID Tiny'] || r.row_data['id_tiny'] || '');
                const status = String(r.row_data['Situação'] || r.row_data['status'] || '').toLowerCase().trim();
                if (id) dbStatusMap.set(id, status);
            });

            let newCount = 0;
            let skipCount = 0;

            for (const { order, orderId } of validOrders) {
                if (dbStatusMap.has(orderId)) {
                    const dbStatus = dbStatusMap.get(orderId);
                    const apiStatus = String(order.situacao || '').toLowerCase().trim();

                    if (dbStatus === apiStatus) {
                        skipCount++;
                    } else {
                        console.log(`Mismatch: ID ${orderId} | DB: "${dbStatus}" vs API: "${apiStatus}"`);
                        newCount++; // Treated as "New" (Update)
                    }
                } else {
                    newCount++; // Actually New
                }
            }
            console.log(`👉 Result: ${newCount} New, ${skipCount} Skipped.`);

            // Stop after 1 page for debugging
            hasMore = false;
            break;
        }
    } catch (e) {
        console.error('Crash:', e);
    }
}

async function main() {
    console.log('🚀 Starting Manual Sync Debug (MVF)...');
    await syncCompanyOrders(COMPANIES[1], 7);
}

main();
