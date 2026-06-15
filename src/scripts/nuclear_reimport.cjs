const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables
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

async function nuclearReimport() {
    console.log('💣 REIMPORTAÇÃO NUCLEAR - ÚLTIMOS 2 DIAS\n');
    console.log('⚠️  DESTRUINDO TUDO E REIMPORTANDO DO ZERO!\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Step 1: Delete EVERYTHING from queue (all 1000 completed entries are stale)
    console.log('💣 DELETANDO TODA A FILA...');
    const { error: e1 } = await supabase
        .from('webhook_retry_queue')
        .delete()
        .neq('id', 0); // Delete all rows

    if (e1) {
        console.error('❌ Erro:', e1.message);
    } else {
        console.log('   ✅ Fila completamente limpa\n');
    }

    // Step 2: Delete from spreadsheet_data (last 2 days)
    console.log('🗑️  Analisando spreadsheet_data...');
    const { data: allOrders } = await supabase
        .from('spreadsheet_data')
        .select('id, row_data');

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const idsToDelete = [];
    allOrders?.forEach(order => {
        const dateStr = order.row_data?.['Data'] || order.row_data?.['data'];
        if (dateStr) {
            const parts = String(dateStr).split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts.map(Number);
                const date = new Date(year, month - 1, day);
                if (date >= twoDaysAgo) {
                    idsToDelete.push(order.id);
                }
            }
        }
    });

    if (idsToDelete.length > 0) {
        console.log(`   🗑️  Deletando ${idsToDelete.length} pedidos...\n`);
        const { error: e2 } = await supabase
            .from('spreadsheet_data')
            .delete()
            .in('id', idsToDelete);

        if (!e2) {
            console.log('   ✅ Spreadsheet limpo\n');
        }
    }

    // Step 3: Force sync with fresh discovery
    console.log('📡 Iniciando sincronização FRESCA...\n');

    const postData = JSON.stringify({
        daysBack: 2,
        maxOrders: 500 // Increased limit
    });

    const options = {
        hostname: 'dashboard-pedidos.vercel.app',
        port: 443,
        path: '/api/sync-tiny', method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('📊 Resultado:');
                    console.log(JSON.stringify(result, null, 2));

                    if (result.stats?.added > 0) {
                        console.log(`\n✅ SUCCESS! ${result.stats.added} pedidos adicionados!`);
                        console.log('📌 Clique em "Processar Fila" agora!\n');
                    } else {
                        console.log('\n❌ PROBLEMA: Nenhum pedido adicionado');
                        console.log(`   Total encontrado: ${result.stats?.total || 0}`);
                        console.log(`   Já conhecidos: ${result.stats?.known || 0}\n`);
                    }
                    resolve(result);
                } catch (err) {
                    console.error('Erro:', err.message);
                    console.log('Raw:', data);
                }
            });
        });
        req.on('error', (err) => console.error('Erro req:', err.message));
        req.write(postData);
        req.end();
    });
}

console.log('⏳ Aguardando 3 segundos... CTRL+C para cancelar\n');
setTimeout(() => nuclearReimport().catch(console.error), 3000);
