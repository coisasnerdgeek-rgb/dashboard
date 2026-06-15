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

// Simulate category logic
const getCategory = (sku) => {
    if (!sku) return 'Unknown';
    if (sku.toLowerCase().includes('cap')) return 'Capinha';
    return 'Roupa'; // Simple simulation
};

async function analyzeClothes() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🧪 ANALISE: Pedidos de Roupas no Banco\n');

    let allData = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('spreadsheet_data')
            .select('row_data, import_date, filename')
            .range(from, to);

        if (error) {
            console.error('Erro:', error);
            break;
        }

        if (data.length < 1000) hasMore = false;
        allData = [...allData, ...data];
        from += 1000;
        to += 1000;

        if (allData.length > 20000) break; // Limit for safety
    }

    console.log(`Total geral no banco: ${allData.length}`);

    const clothes = allData.filter(row => {
        const d = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data;
        const sku = d['SKU'] || '';
        return getCategory(sku) === 'Roupa';
    });

    console.log(`Total roupas no banco: ${clothes.length}`);

    // Groups by Filename
    const files = {};
    clothes.forEach(row => {
        files[row.filename] = (files[row.filename] || 0) + 1;
    });

    console.log('\n📁 Arquivos contendo roupas:');
    Object.entries(files).forEach(([f, c]) => {
        console.log(`   - ${f}: ${c} itens`);
    });

    // Check recent clothes
    const recentClothes = clothes.sort((a, b) => new Date(b.import_date) - new Date(a.import_date)).slice(0, 10);
    console.log('\n🆕 Amostra de roupas recentes (ID Venda + Data):');
    recentClothes.forEach(row => {
        const d = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data;
        console.log(`   - ID: ${d['Número da ordem de compra'] || d['ID Venda']} | Data: ${d['Data']} | Import: ${row.import_date}`);
    });
}

analyzeClothes().catch(console.error);
