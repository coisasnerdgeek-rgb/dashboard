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

async function analyze() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get all from spreadsheet
    const { data: all } = await supabase.from('spreadsheet_data').select('row_data');

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    let last2Days = 0;
    const orderIds = new Set();

    all?.forEach(row => {
        const dateStr = row.row_data?.['Data'];
        const tinyId = row.row_data?.['ID Tiny'];

        if (dateStr) {
            const [day, month, year] = String(dateStr).split('/').map(Number);
            if (year && month && day) {
                const date = new Date(year, month - 1, day);
                if (date >= twoDaysAgo) {
                    last2Days++;
                    if (tinyId) orderIds.add(tinyId);
                }
            }
        }
    });

    console.log(`📊 Spreadsheet Analysis:`);
    console.log(`   Total orders: ${all?.length || 0}`);
    console.log(`   Last 2 days: ${last2Days}`);
    console.log(`   Unique ID Tiny from last 2 days: ${orderIds.size}\n`);

    console.log(`Sample IDs from last 2 days:`);
    Array.from(orderIds).slice(0, 10).forEach(id => console.log(`   - ${id}`));
}

analyze();
