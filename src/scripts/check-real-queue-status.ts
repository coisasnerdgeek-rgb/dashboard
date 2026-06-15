/**
 * Verificar estado REAL da fila de retry
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = value;
        }
    });
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkQueueStatus() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n📊 VERIFICANDO FILA DE RETRY\n');
    console.log('='.repeat(60) + '\n');

    // Total geral
    const { count: total } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true });

    console.log(`   📋 Total na fila: ${total || 0}\n`);

    // Por status
    const statuses = ['pending', 'processing', 'completed', 'failed'];

    for (const status of statuses) {
        const { count } = await supabase
            .from('webhook_retry_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', status);

        console.log(`      ${status}: ${count || 0}`);
    }

    console.log('');

    // Pedidos recentes (>= 26/01/2026)
    const { count: recent } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true })
        .gte('order_date', '2026-01-26');

    console.log(`   📅 Pedidos >= 26/01/2026: ${recent || 0}`);

    // Pedidos sem data
    const { count: noDate } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true })
        .is('order_date', null);

    console.log(`   ❓ Pedidos sem data: ${noDate || 0}`);

    // Pedidos antigos
    const { count: old } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true })
        .lt('order_date', '2026-01-26');

    console.log(`   🗑️  Pedidos < 26/01/2026: ${old || 0}\n`);

    console.log('='.repeat(60) + '\n');
}

checkQueueStatus().catch(console.error);
