const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
    }
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function diagnoseQueue() {
    console.log('🔍 Diagnóstico da Fila de Pedidos\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Count orders in spreadsheet_data
    const { count: totalOrders, error: e1 } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true });

    console.log(`📊 Total de pedidos em spreadsheet_data: ${totalOrders || 'erro'}`);
    if (e1) console.error('Erro:', e1.message);

    // 2. Count queue statuses
    const { data: queueData, error: e2 } = await supabase
        .from('webhook_retry_queue')
        .select('status');

    if (!e2 && queueData) {
        const statusCounts = {};
        queueData.forEach(row => {
            const status = row.status || 'null';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        console.log('\n🔄 Status da Fila (webhook_retry_queue):');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   ${status}: ${count}`);
        });
        console.log(`   TOTAL NA FILA: ${queueData.length}`);
    } else {
        console.error('Erro ao buscar fila:', e2?.message);
    }

    // 3. Recent failed orders
    const { data: failedOrders, error: e3 } = await supabase
        .from('webhook_retry_queue')
        .select('order_id, last_error, retry_count, created_at')
        .in('status', ['failed', 'error'])
        .order('created_at', { ascending: false })
        .limit(10);

    if (!e3 && failedOrders && failedOrders.length > 0) {
        console.log('\n❌ Últimos pedidos com falha:');
        failedOrders.forEach(order => {
            console.log(`   ${order.order_id}: ${order.last_error?.substring(0, 80)}...`);
        });
    }

    // 4. Pending orders count
    const { count: pendingCount, error: e4 } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    console.log(`\n⏳ Pedidos pendentes: ${pendingCount || 0}`);

    // 5. Check if there's a mismatch
    const queueTotal = queueData?.length || 0;
    const inSpreadsheet = totalOrders || 0;
    const gap = queueTotal - inSpreadsheet;

    console.log(`\n📈 Análise:`);
    console.log(`   Pedidos na fila: ${queueTotal}`);
    console.log(`   Pedidos processados (spreadsheet): ${inSpreadsheet}`);
    console.log(`   Diferença: ${gap}`);

    if (gap > 0) {
        console.log(`\n⚠️  Há ${gap} pedidos na fila que ainda não foram processados com sucesso.`);
    } else {
        console.log(`\n✅ Todos os pedidos da fila foram processados.`);
    }
}

diagnoseQueue().catch(console.error);
