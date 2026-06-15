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
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function truncateQueue() {
    console.log('💣 TRUNCATING webhook_retry_queue...\n');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Try using RPC or raw SQL
    const { error } = await supabase.rpc('exec_sql', {
        query: 'TRUNCATE TABLE webhook_retry_queue;'
    });

    if (error) {
        console.log('⚠️  TRUNCATE failed:', error.message);
        console.log('   Trying DELETE with chunks...\n');

        // Fallback: delete in chunks
        let deleted = 0;
        while (true) {
            const { data, error: e2 } = await supabase
                .from('webhook_retry_queue')
                .select('id')
                .limit(100);

            if (!data || data.length === 0) break;

            const ids = data.map(r => r.id);
            await supabase.from('webhook_retry_queue').delete().in('id', ids);
            deleted += ids.length;
            console.log(`   Deleted ${deleted} so far...`);
        }

        console.log(`\n✅ Deleted ${deleted} total records\n`);
    } else {
        console.log('✅ TRUNCATE successful!\n');
    }

    // Verify
    const { count } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true });

    console.log(`📊 Queue count: ${count}\n`);
}

truncateQueue().catch(console.error);
