const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function analyzeMissing() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🔬 ANÁLISE DETALHADA: Pedidos Marcados "Completed" mas Ausentes\n');

    // Get completed orders from queue
    const { data: queueData } = await supabase
        .from('webhook_retry_queue')
        .select('order_id, last_error, retry_count, created_at')
        .eq('status', 'completed');

    const completedOrderIds = new Set(queueData?.map(q => String(q.order_id)) || []);

    // Get orders from spreadsheet
    const { data: spreadsheetData } = await supabase
        .from('spreadsheet_data')
        .select('row_data');

    const spreadsheetOrderIds = new Set();
    spreadsheetData?.forEach(row => {
        try {
            const data = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data;
            const orderId = data['Número da ordem de compra'] || data['Identificador do pedido e-commerce'];
            if (orderId) spreadsheetOrderIds.add(String(orderId));
        } catch (e) { }
    });

    // Find missing
    const missing = [];
    completedOrderIds.forEach(id => {
        if (!spreadsheetOrderIds.has(id)) {
            const queueInfo = queueData.find(q => String(q.order_id) === id);
            missing.push({
                order_id: id,
                last_error: queueInfo?.last_error,
                retry_count: queueInfo?.retry_count,
                created_at: queueInfo?.created_at
            });
        }
    });

    console.log(`Total COMPLETED na fila: ${completedOrderIds.size}`);
    console.log(`Total no spreadsheet:    ${spreadsheetOrderIds.size}`);
    console.log(`FALTANDO:                ${missing.length}\n`);

    if (missing.length > 0) {
        console.log('📋 Detalhes dos primeiros 20 pedidos faltando:\n');
        missing.slice(0, 20).forEach((m, i) => {
            console.log(`${i + 1}. Order ID: ${m.order_id}`);
            console.log(`   Last Error: ${m.last_error || 'None'}`);
            console.log(`   Retries: ${m.retry_count}`);
            console.log(`   Created: ${m.created_at}`);
            console.log('');
        });

        // Check if these are duplicates (multiple items for same order)
        const orderIdsInSpreadsheet = Array.from(spreadsheetOrderIds);
        const duplicatesInMissing = missing.filter(m =>
            orderIdsInSpreadsheet.some(sid => String(sid) === String(m.order_id))
        );

        if (duplicatesInMissing.length > 0) {
            console.log(`\n⚠️  ${duplicatesInMissing.length} pedidos "faltando" na verdade TEM itens no spreadsheet!`);
            console.log('   (Provavelmente pedidos com múltiplos itens onde alguns foram inseridos)');
        }
    }
}

analyzeMissing().catch(console.error);
