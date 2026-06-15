const { createClient } = require('@supabase/supabase-js');
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

async function clearLast3Days() {
    console.log('🔄 Limpando fila dos últimos 3 dias...\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Calculate 3 days ago date
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);

    const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const cutoffDate = formatDate(threeDaysAgo);
    console.log(`📅 Removendo pedidos com data >= ${cutoffDate}\n`);

    // Get all orders from queue with order_date
    const { data: queueOrders, error: e1 } = await supabase
        .from('webhook_retry_queue')
        .select('id, order_id, order_date, created_at');

    if (e1) {
        console.error('Erro ao buscar fila:', e1.message);
        return;
    }

    // Filter orders from last 3 days
    const idsToDelete = [];
    const orderIdsToDelete = [];

    queueOrders.forEach(order => {
        const orderDate = order.order_date;
        if (orderDate) {
            const parts = orderDate.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts.map(Number);
                const date = new Date(year, month - 1, day);
                if (date >= threeDaysAgo) {
                    idsToDelete.push(order.id);
                    orderIdsToDelete.push(order.order_id);
                }
            }
        }
    });

    console.log(`🗑️  Pedidos a remover da fila: ${idsToDelete.length}`);

    if (idsToDelete.length > 0) {
        // Delete from queue
        const { error: e2 } = await supabase
            .from('webhook_retry_queue')
            .delete()
            .in('id', idsToDelete);

        if (e2) {
            console.error('Erro ao deletar da fila:', e2.message);
        } else {
            console.log(`✅ Removidos ${idsToDelete.length} pedidos da fila`);
        }

        // Optionally delete from spreadsheet_data as well
        console.log(`\n🗑️  Deseja também remover ${orderIdsToDelete.length} pedidos do spreadsheet_data?`);
        console.log('   (Isso forçará re-importação completa)');
        console.log('   Execute com argumento --delete-data para confirmar\n');

        if (process.argv.includes('--delete-data')) {
            const { data: spreadsheetData } = await supabase
                .from('spreadsheet_data')
                .select('id, row_data');

            const spreadsheetIdsToDelete = [];
            spreadsheetData?.forEach(row => {
                const tinyId = row.row_data?.['ID Tiny'];
                if (tinyId && orderIdsToDelete.includes(tinyId)) {
                    spreadsheetIdsToDelete.push(row.id);
                }
            });

            if (spreadsheetIdsToDelete.length > 0) {
                const { error: e3 } = await supabase
                    .from('spreadsheet_data')
                    .delete()
                    .in('id', spreadsheetIdsToDelete);

                if (e3) {
                    console.error('Erro ao deletar do spreadsheet:', e3.message);
                } else {
                    console.log(`✅ Removidos ${spreadsheetIdsToDelete.length} pedidos do spreadsheet_data`);
                }
            }
        }
    } else {
        console.log('ℹ️  Nenhum pedido dos últimos 3 dias encontrado na fila');
    }

    console.log('\n✅ Limpeza concluída!');
    console.log('📌 Agora clique em "Sincronizar Tiny" no dashboard para re-importar');
}

clearLast3Days().catch(console.error);
