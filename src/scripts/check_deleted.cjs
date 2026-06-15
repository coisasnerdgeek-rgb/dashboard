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

async function checkDeletedOrders() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('🗑️  CHECK: Pedidos Deletados\n');

    const { data, error } = await supabase
        .from('deleted_orders')
        .select('*');

    if (error) {
        console.error('Erro:', error);
        return;
    }

    console.log(`Total deletados no banco: ${data.length}`);
    data.slice(0, 5).forEach(d => {
        console.log(`   - ID No Banco (order_id): ${d.order_id} | Tiny: ${d.tiny_id} | Deletado em: ${d.deleted_at}`);
    });

    console.log('\n🔍 Verificando se esses IDs existem no spreadsheet_data...');
    if (data.length > 0) {
        const { data: spreadsheetData } = await supabase
            .from('spreadsheet_data')
            .select('id, filename')
            .in('id', data.map(d => d.order_id));

        console.log(`Dos deletados, ${spreadsheetData.length} ainda existem no spreadsheet_data.`);
        spreadsheetData.slice(0, 5).forEach(s => {
            console.log(`   - ID: ${s.id} (File: ${s.filename})`);
        });
    }
}

checkDeletedOrders().catch(console.error);
