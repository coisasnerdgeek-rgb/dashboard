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

async function fullReimport() {
    console.log('🔄 REIMPORTAÇÃO COMPLETA - ÚLTIMOS 2 DIAS\n');
    console.log('⚠️  ATENÇÃO: Isso vai DELETAR todos os pedidos dos últimos 2 dias e reimportar do zero!\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Calculate 2 days ago
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);

    const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const cutoffDate = formatDate(twoDaysAgo);
    console.log(`📅 Data de corte: >= ${cutoffDate}\n`);

    // Step 1: Get all orders from spreadsheet_data
    console.log('📊 Analisando spreadsheet_data...');
    const { data: allOrders, error: e1 } = await supabase
        .from('spreadsheet_data')
        .select('id, row_data');

    if (e1) {
        console.error('❌ Erro:', e1.message);
        return;
    }

    // Filter by date
    const idsToDelete = [];
    const orderIdsToDelete = new Set();

    allOrders.forEach(order => {
        const rowData = order.row_data;
        const dateStr = rowData['Data'] || rowData['data'];
        if (dateStr && typeof dateStr === 'string') {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts.map(Number);
                const date = new Date(year, month - 1, day);
                if (date >= twoDaysAgo) {
                    idsToDelete.push(order.id);
                    const tinyId = rowData['ID Tiny'];
                    if (tinyId) orderIdsToDelete.add(String(tinyId));
                }
            }
        }
    });

    console.log(`   🗑️  Pedidos a deletar do spreadsheet: ${idsToDelete.length}\n`);

    // Step 2: Get ALL queue entries (to find by created_at if order_date doesn't exist)
    console.log('🗑️  Analisando fila (webhook_retry_queue)...');
    const { data: allQueueOrders } = await supabase
        .from('webhook_retry_queue')
        .select('*');

    const queueIdsToDelete = [];
    const cutoffTime = twoDaysAgo.getTime();

    allQueueOrders?.forEach(q => {
        // Delete if order_id matches OR if created recently
        if (orderIdsToDelete.has(String(q.order_id))) {
            queueIdsToDelete.push(q.id);
        } else {
            const createdAt = new Date(q.created_at);
            if (createdAt.getTime() >= cutoffTime) {
                queueIdsToDelete.push(q.id);
            }
        }
    });

    console.log(`   🗑️  Registros a deletar da fila: ${queueIdsToDelete.length}\n`);

    // Step 3: Delete from queue first (important!)
    if (queueIdsToDelete.length > 0) {
        console.log('🗑️  Limpando fila...');
        const { error: e3 } = await supabase
            .from('webhook_retry_queue')
            .delete()
            .in('id', queueIdsToDelete);

        if (e3) {
            console.error('❌ Erro ao deletar da fila:', e3.message);
        } else {
            console.log(`   ✅ Deletados ${queueIdsToDelete.length} registros da fila\n`);
        }
    }

    // Step 4: Delete from spreadsheet_data
    if (idsToDelete.length > 0) {
        console.log('🗑️  Deletando do spreadsheet_data...');
        const { error: e2 } = await supabase
            .from('spreadsheet_data')
            .delete()
            .in('id', idsToDelete);

        if (e2) {
            console.error('❌ Erro ao deletar:', e2.message);
            return;
        }
        console.log(`   ✅ Deletados ${idsToDelete.length} pedidos\n`);
    }

    // Step 5: Trigger fresh import
    console.log('📡 Iniciando importação fresca dos últimos 2 dias...\n');

    const hostname = 'dashboard-pedidos.vercel.app';
    const apiPath = '/api/sync-tiny';
    const postData = JSON.stringify({
        daysBack: 2,
        maxOrders: 1000
    });

    const options = {
        hostname: hostname,
        port: 443,
        path: apiPath,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(data);

                    console.log('📊 Resultado do Sync:');
                    console.log(JSON.stringify(result, null, 2));

                    if (result.stats && result.stats.added > 0) {
                        console.log(`\n✅ ${result.stats.added} pedidos adicionados à fila!`);
                        console.log('📌 Agora clique em "Processar Fila" no dashboard para importar\n');
                    } else {
                        console.log('\n⚠️  Nenhum pedido adicionado à fila.');
                        console.log('   Todos os ${result.stats?.total || 0} pedidos já estavam conhecidos.\n');
                    }

                    resolve(result);
                } catch (error) {
                    console.error('❌ Erro ao parsear resposta:', error.message);
                    console.log('Resposta:', data);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Erro na requisição:', error.message);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

console.log('⚠️  Confirme que deseja continuar! Pressione CTRL+C para cancelar...');
setTimeout(() => {
    fullReimport().catch(console.error);
}, 3000);
