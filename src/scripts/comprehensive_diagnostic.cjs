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

async function comprehensiveDiagnostic() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🔍 DIAGNÓSTICO ABRANGENTE\n');
    console.log('='.repeat(60));

    // 1. Queue status
    const { data: queueData } = await supabase
        .from('webhook_retry_queue')
        .select('status');

    const queueStats = {};
    queueData?.forEach(q => {
        const status = q.status || 'unknown';
        queueStats[status] = (queueStats[status] || 0) + 1;
    });

    console.log('\n📋 FILA (webhook_retry_queue):');
    Object.entries(queueStats).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
    });
    console.log(`   TOTAL: ${queueData?.length || 0}`);

    // 2. Spreadsheet total
    const { count: totalCount } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true });

    console.log('\n📊 SPREADSHEET_DATA:');
    console.log(`   Total de registros: ${totalCount}`);

    // 3. Sample 5 records to check structure
    const { data: sampleData } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .limit(5);

    console.log('\n🔬 AMOSTRA DE DADOS (5 registros):');
    sampleData?.forEach((row, i) => {
        const data = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data;
        console.log(`\n   Registro ${i + 1}:`);
        console.log(`   - Produto: ${data['Produto'] || 'N/A'}`);
        console.log(`   - SKU: ${data['SKU'] || 'N/A'}`);
        console.log(`   - Pedido: ${data['Número da ordem de compra'] || 'N/A'}`);
        console.log(`   - Quantidade: ${data['Quantidade'] || 'N/A'}`);
        console.log(`   - Origem: ${data['Origem'] || 'N/A'}`);
        console.log(`   - Canal: ${data['Canal'] || 'N/A'}`);
    });

    // 4. Count by origin
    const { data: allData } = await supabase
        .from('spreadsheet_data')
        .select('row_data');

    const byOrigin = {};
    const byCanal = {};
    const uniqueProducts = new Set();
    const uniqueOrders = new Set();

    allData?.forEach(row => {
        try {
            const data = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data;
            const origin = data['Origem'] || 'Unknown';
            const canal = data['Canal'] || 'Unknown';
            const product = data['Produto'];
            const order = data['Número da ordem de compra'];

            byOrigin[origin] = (byOrigin[origin] || 0) + 1;
            byCanal[canal] = (byCanal[canal] || 0) + 1;
            if (product) uniqueProducts.add(product);
            if (order) uniqueOrders.add(order);
        } catch (e) { }
    });

    console.log('\n📈 BREAKDOWN POR ORIGEM:');
    Object.entries(byOrigin).forEach(([origin, count]) => {
        console.log(`   ${origin}: ${count}`);
    });

    console.log('\n🏪 BREAKDOWN POR CANAL:');
    Object.entries(byCanal).forEach(([canal, count]) => {
        console.log(`   ${canal}: ${count}`);
    });

    console.log('\n📦 AGREGADOS:');
    console.log(`   Produtos únicos: ${uniqueProducts.size}`);
    console.log(`   Pedidos únicos: ${uniqueOrders.size}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 ANÁLISE:');
    console.log(`   Se você vê apenas ~10% dos pedidos no app:`);
    console.log(`   - Database tem: ${totalCount} itens`);
    console.log(`   - Pedidos únicos: ${uniqueOrders.size}`);
    console.log(`   \n   Verifique:`);
    console.log(`   1. Filtros de data no app?`);
    console.log(`   2. Filtros de status/situação?`);
    console.log(`   3. Component loading limit?`);
    console.log(`   4. selectedCnpj filter active?`);
}

comprehensiveDiagnostic().catch(console.error);
