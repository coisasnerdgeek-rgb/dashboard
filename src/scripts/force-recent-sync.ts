
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim();
});

const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM || env.TINY_API_TOKEN_MM || env.TINY_API_TOKEN;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF || env.TINY_API_TOKEN_MVF;

const COMPANIES = [
    { name: 'MM', token: TINY_TOKEN_MM, enabled: !!TINY_TOKEN_MM },
    { name: 'MVF', token: TINY_TOKEN_MVF, enabled: !!TINY_TOKEN_MVF }
];

async function forceSync() {
    console.log('🚀 Forcing sync for last 4 days...');

    // Date range: last 4 days to be sure
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 4);

    const formatDate = (date: any) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const dataInicial = formatDate(startDate);
    const dataFinal = formatDate(endDate);

    console.log(`Dates: ${dataInicial} to ${dataFinal}`);

    for (const company of COMPANIES) {
        if (!company.enabled) continue;
        console.log(`\nSyncing ${company.name}...`);

        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const url = `https://api.tiny.com.br/api2/pedidos.pesquisa.php?token=${company.token}&formato=JSON&dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=${page}`;
            console.log(`Fetching page ${page}...`);

            try {
                const res = await fetch(url);
                const json = await res.json();

                if (json.retorno.status !== 'OK') {
                    console.log(`Response status: ${json.retorno.status}`);
                    hasMore = false;
                    continue;
                }

                const orders = json.retorno.pedidos || [];
                console.log(`Found ${orders.length} orders.`);

                if (orders.length === 0) {
                    hasMore = false;
                    continue;
                }

                // Insert into Queue directly
                const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

                for (const o of orders) {
                    const orderId = String(o.pedido.id);
                    const orderDate = o.pedido.data_pedido;
                    console.log(`   - Queueing Order ${orderId} (${orderDate})`);

                    const { error } = await supabase
                        .from('webhook_retry_queue')
                        .insert({
                            order_id: orderId,
                            company: company.name,
                            status: 'pending',
                            retry_count: 0,
                            next_retry_at: new Date().toISOString(),
                            order_date: orderDate,
                            payload: { cnpj: '39447291000104', origin: 'Manual Force Sync' } // Dummy CNPJ for payload, processor handles lookup?
                            // Actually, let's use check-if-exists logic? No, just force insert. The cron job does upserts or ignores.
                        });

                    if (error) console.error('     Insert error:', error.message);
                }

                page++;
                await new Promise(r => setTimeout(r, 1000));

            } catch (e) {
                console.error(e);
                hasMore = false;
            }
        }
    }
}

forceSync();
