const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        process.env[match[1].trim()] = match[2].trim();
    }
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function wipeAndResync() {
    console.log('💣 WIPING LAST 2 DAYS & RESYNCING\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Delete from spreadsheet_data (línea 113 checa esto primero!)
    console.log('🗑️  Step 1: Deleting from spreadsheet_data...');
    const { data: allOrders } = await supabase
        .from('spreadsheet_data')
        .select('id, row_data');

    const idsToDelete = [];
    allOrders?.forEach(order => {
        const dateStr = order.row_data?.['Data'];
        if (dateStr) {
            const [day, month, year] = String(dateStr).split('/').map(Number);
            if (year && month && day) {
                const date = new Date(year, month - 1, day);
                if (date >= twoDaysAgo) {
                    idsToDelete.push(order.id);
                }
            }
        }
    });

    console.log(`   Found ${idsToDelete.length} orders to delete\n`);

    if (idsToDelete.length > 0) {
        await supabase.from('spreadsheet_data').delete().in('id', idsToDelete);
        console.log('   ✅ Deleted from spreadsheet_data\n');
    }

    // Delete from queue
    console.log('🗑️  Step 2: Wiping queue...');
    const { data: queue } = await supabase.from('webhook_retry_queue').select('id');
    if (queue && queue.length > 0) {
        const queueIds = queue.map(q => q.id);
        await supabase.from('webhook_retry_queue').delete().in('id', queueIds);
        console.log(`   ✅ Deleted ${queue.length} from queue\n`);
    }

    // Sync
    console.log('📡 Step 3: Syncing fresh data...\n');

    const postData = JSON.stringify({ daysBack: 2 });
    const options = {
        hostname: 'dashboard-pedidos.vercel.app',
        port: 443,
        path: '/api/sync-tiny',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const result = JSON.parse(data);
                console.log(JSON.stringify(result, null, 2));

                if (result.stats?.added > 0) {
                    console.log(`\n✅ SUCCESS! ${result.stats.added} orders added to queue!`);
                    console.log('📌 Now click "Processar Fila" in dashboard!\n');
                } else {
                    console.log('\n⚠️  No orders added. Check above.\n');
                }
                resolve(result);
            });
        });
        req.on('error', err => console.error('Error:', err.message));
        req.write(postData);
        req.end();
    });
}

setTimeout(() => wipeAndResync().catch(console.error), 2000);
