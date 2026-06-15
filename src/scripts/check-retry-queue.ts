/**
 * Script para verificar o estado da fila de retry
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
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

async function checkRetryQueue() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n📊 Checking Retry Queue Status\n');

    // Count by status
    const { data: allItems } = await supabase
        .from('webhook_retry_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (!allItems) {
        console.log('❌ Failed to fetch queue');
        return;
    }

    const statusCounts = allItems.reduce((acc: any, item: any) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
    }, {});

    console.log('📈 Queue Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
    });

    // Show pending items that should have been processed
    const now = new Date();
    const pendingOverdue = allItems.filter((item: any) =>
        item.status === 'pending' && new Date(item.next_retry_at) < now
    );

    if (pendingOverdue.length > 0) {
        console.log(`\n⚠️  Found ${pendingOverdue.length} OVERDUE pending items:`);
        pendingOverdue.slice(0, 10).forEach((item: any) => {
            console.log(`\n   Order ID: ${item.order_id}`);
            console.log(`   Company: ${item.company}`);
            console.log(`   Next Retry: ${item.next_retry_at}`);
            console.log(`   Retry Count: ${item.retry_count}/${item.max_retries}`);
            console.log(`   Last Error: ${item.last_error || 'None'}`);
        });

        // Reset overdue items
        console.l(`\n🔄 Resetting ${pendingOverdue.length} overdue items...`);
        const { error } = await supabase
            .from('webhook_retry_queue')
            .update({
                next_retry_at: new Date().toISOString()
            })
            .in('id', pendingOverdue.map(i => i.id));

        if (error) {
            console.error('❌ Failed to reset:', error);
        } else {
            console.log('✅ Reset complete! Items should be processed in the next cycle.');
        }
    } else {
        console.log('\n✅ No overdue items found');
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

checkRetryQueue().catch(console.error);
