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

async function analyzeStatuses() {
    console.log('🔍 Análise de Status dos Pedidos\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get all orders with their status (situacao)
    const { data: orders, error } = await supabase
        .from('spreadsheet_data')
        .select('row_data');

    if (error) {
        console.error('Erro:', error.message);
        return;
    }

    console.log(`📊 Total de pedidos no banco: ${orders.length}\n`);

    // Analyze status distribution
    const statusCounts = {};
    let noStatus = 0;

    orders.forEach(order => {
        const rowData = order.row_data;
        const situacao = (rowData['Situação'] || rowData['situacao'] || rowData['Status'] || rowData['status'] || '').toLowerCase().trim();

        if (!situacao) {
            noStatus++;
        } else {
            statusCounts[situacao] = (statusCounts[situacao] || 0) + 1;
        }
    });

    console.log('📈 Distribuição por Status:');
    const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
    sortedStatuses.forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
    });
    if (noStatus > 0) {
        console.log(`   [SEM STATUS]: ${noStatus}`);
    }

    // Check filter impact
    const allowedStatuses = ['aprovado', 'faturado', 'preparando'];
    let wouldBeFiltered = 0;
    let wouldPass = 0;

    orders.forEach(order => {
        const rowData = order.row_data;
        const situacao = (rowData['Situação'] || rowData['situacao'] || rowData['Status'] || rowData['status'] || '').toLowerCase().trim();
        const isAllowed = allowedStatuses.some(s => situacao.includes(s));

        if (isAllowed) {
            wouldPass++;
        } else {
            wouldBeFiltered++;
        }
    });

    console.log(`\n⚠️  Impacto do Filtro ["aprovado", "faturado", "preparando"]:`);
    console.log(`   ✅ Passariam: ${wouldPass}`);
    console.log(`   ❌ Seriam bloqueados: ${wouldBeFiltered}`);
    console.log(`   📉 % filtrado: ${((wouldBeFiltered / orders.length) * 100).toFixed(1)}%`);
}

analyzeStatuses().catch(console.error);
