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

// Simplified parseSku logic from components/CriarPedido.tsx
const parseSku = (sku) => {
    if (!sku) return null;
    const parts = sku.split('-');
    if (parts.length < 3) return null;
    return {
        productName: parts[0],
        category: parts[0].includes('cap') ? 'Capinha' : 'Outro'
    };
};

async function checkCategories() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await supabase.from('spreadsheet_data').select('row_data');

    const stats = {
        total: data.length,
        capinha: 0,
        outro: 0,
        unparsed: 0
    };

    data.forEach(row => {
        const d = typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data;
        const sku = d['SKU'] || '';

        // This logic simulates getCategory(sku) === 'Capinha'
        if (sku.toLowerCase().includes('cap')) {
            stats.capinha++;
        } else if (sku) {
            stats.outro++;
        } else {
            stats.unparsed++;
        }
    });

    console.log('📊 CATEGORIAS (Filtro Interno):');
    console.log(`   Total:   ${stats.total}`);
    console.log(`   Capinha: ${stats.capinha} (${Math.round(stats.capinha / stats.total * 100)}%)`);
    console.log(`   Outros:  ${stats.outro} (${Math.round(stats.outro / stats.total * 100)}%)`);
    console.log(`   Vazio:   ${stats.unparsed}`);
}

checkCategories();
