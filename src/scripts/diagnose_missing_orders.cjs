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

async function diagnose() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🔍 DIAGNÓSTICO: Pedidos Desaparecidos\n');
    console.log('='.repeat(60));

    // Get queue stats
    const { data: queueData } = await supabase
        .from('webhook_retry_queue')
        .select('status, order_id');

    const queueStats = {
        pending: 0,
        completed: 0,
        failed: 0,
        error: 0
    };

    const completedOrderIds = new Set();

    queueData?.forEach(q => {
        const status = q.status || 'unknown';
        queueStats[status] = (queueStats[status] || 0) + 1;

        if (status === 'completed') {
            completedOrderIds.add(q.order_id);
        }
    });

    console.log('\n📋 FILA (webhook_retry_queue):');
    console.log(`   Pending:   ${queueStats.pending}`);
    console.log(`   Completed: ${queueStats.completed}`);
    console.log(`   Failed:    ${queueStats.failed}`);
    console.log(`   Error:     ${queueStats.error}`);
    console.log(`   Total:     ${queueData?.length || 0}`);

    // Get spreadsheet count
    const { count: spreadsheetCount } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true });

    console.log('\n📊 SPREADSHEET_DATA:');
    console.log(`   Total: ${spreadsheetCount}`);

    // Get actual order IDs from spreadsheet
    const { data: spreadsheetData } = await supabase
        .from('spreadsheet_data')
        .select('row_data');

    const spreadsheetOrderIds = new Set();
    spreadsheetData?.forEach(row => {
        try {
            const data = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data;
            // Use the correct field name from the actual data structure
            const orderId = data['Número da ordem de compra'] || data['Identificador do pedido e-commerce'];
            if (orderId) {
                spreadsheetOrderIds.add(String(orderId));
            }
        } catch (e) {
            // ignore parse errors
        }
    });

    console.log(`   Unique Order IDs: ${spreadsheetOrderIds.size}`);

    // Find completed orders NOT in spreadsheet
    const missingOrders = [];
    completedOrderIds.forEach(id => {
        if (!spreadsheetOrderIds.has(String(id))) {
            missingOrders.push(id);
        }
    });

    console.log('\n❌ PROBLEMA ENCONTRADO:');
    console.log(`   Completed na fila: ${completedOrderIds.size}`);
    console.log(`   No spreadsheet:    ${spreadsheetOrderIds.size}`);
    console.log(`   FALTANDO:          ${missingOrders.length}`);

    if (missingOrders.length > 0) {
        console.log('\n📝 Amostras de IDs faltando:');
        missingOrders.slice(0, 10).forEach(id => console.log(`   - ${id}`));
        if (missingOrders.length > 10) {
            console.log(`   ... e mais ${missingOrders.length - 10}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 CONCLUSÃO:');
    if (missingOrders.length > 0) {
        console.log(`   ⚠️  ${missingOrders.length} pedidos foram marcados como "completed"`);
        console.log(`   mas NÃO foram inseridos no spreadsheet_data!`);
        console.log(`\n   Isso explica por que você vê ${queueStats.completed} processados`);
        console.log(`   mas apenas ${spreadsheetCount} no app.`);
    } else {
        console.log(`   ✅ Todos os pedidos completed estão no spreadsheet!`);
    }
}

diagnose().catch(console.error);
