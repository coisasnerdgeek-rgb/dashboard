/**
 * Script para forçar reprocessamento de um pedido específico
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

async function forceReprocess(tinyId: string) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log(`\n🔄 Force Reprocessing Order: ${tinyId}\n`);

    // Check if exists in queue
    const { data: existing } = await supabase
        .from('webhook_retry_queue')
        .select('*')
        .eq('order_id', tinyId);

    if (existing && existing.length > 0) {
        console.log(`✅ Found ${existing.length} item(s) in queue`);
        console.log(`   Status: ${existing[0].status}`);
        console.log(`   Retry Count: ${existing[0].retry_count}`);

        // Reset to pending
        const { error } = await supabase
            .from('webhook_retry_queue')
            .update({
                status: 'pending',
                retry_count: 0,
                next_retry_at: new Date().toISOString(),
                last_error: null
            })
            .eq('order_id', tinyId);

        if (error) {
            console.error('❌ Failed to reset:', error);
        } else {
            console.log('\n✅ Successfully reset to pending!');
            console.log('   Will be processed in the next cycle (~1 minute)');
        }
    } else {
        console.log('⚠️  Order not found in retry queue');
        console.log('   Adding fresh entry...');

        // Add fresh entry
        const { error } = await supabase
            .from('webhook_retry_queue')
            .insert({
                order_id: tinyId,
                company: 'MM', // Default to MM, will auto-detect if needed
                status: 'pending',
                retry_count: 0,
                max_retries: 5,
                next_retry_at: new Date().toISOString(),
                payload: { origin: 'Manual Force' }
            });

        if (error) {
            console.error('❌ Failed to add:', error);
        } else {
            console.log('\n✅ Successfully added to queue!');
            console.log('   Will be processed in the next cycle (~1 minute)');
        }
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

const tinyId = process.argv[2] || '950275706';
forceReprocess(tinyId).catch(console.error);
