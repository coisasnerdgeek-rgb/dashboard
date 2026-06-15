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

async function deepAnalyze() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🧪 ANALISE PROFUNDA: Status e Filtros\n');

    const { data: allData, error } = await supabase
        .from('spreadsheet_data')
        .select('row_data');

    if (error) {
        console.error('Erro ao buscar dados:', error);
        return;
    }

    const stats = {
        totalRows: allData.length,
        byStatus: {},
        byCNPJ: {},
        uniqueOrders: new Set(),
        byDate: {}
    };

    allData.forEach(row => {
        const d = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data;
        const status = d['Situação'] || d['Situação do Pedido'] || 'N/A';
        const cnpj = d['CNPJ'] || 'N/A';
        const orderId = d['Número da ordem de compra'] || d['ID Venda'] || d['id venda'];
        const date = d['Data'] || 'N/A';

        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        stats.byCNPJ[cnpj] = (stats.byCNPJ[cnpj] || 0) + 1;
        if (orderId) stats.uniqueOrders.add(orderId);

        // Month-Year group
        if (date && date.includes('/')) {
            const parts = date.split('/');
            if (parts.length === 3) {
                const monthYear = `${parts[1]}/${parts[2]}`;
                stats.byDate[monthYear] = (stats.byDate[monthYear] || 0) + 1;
            }
        }
    });

    console.log(`Total registros: ${stats.totalRows}`);
    console.log(`Pedidos únicos:  ${stats.uniqueOrders.size}`);

    console.log('\n📊 Status:');
    Object.entries(stats.byStatus).sort(([, a], [, b]) => b - a).forEach(([k, v]) => {
        console.log(`   - ${k}: ${v}`);
    });

    console.log('\n🏢 CNPJ:');
    Object.entries(stats.byCNPJ).sort(([, a], [, b]) => b - a).forEach(([k, v]) => {
        console.log(`   - ${k}: ${v}`);
    });

    console.log('\n📅 Datas (Mês/Ano):');
    Object.entries(stats.byDate).sort().forEach(([k, v]) => {
        console.log(`   - ${k}: ${v}`);
    });
}

deepAnalyze();
