
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach((line) => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                process.env[key.trim()] = value;
            }
        });
    }
} catch (e) { }

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Credentials');
    process.exit(1);
}

async function diagnose() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get failed items
    const { data, error } = await supabase
        .from('webhook_retry_queue')
        .select('last_error, status, retry_count')
        .in('status', ['failed', 'error']);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    const errorCounts = {};
    data.forEach(row => {
        const msg = row.last_error || 'Unknown Error';
        errorCounts[msg] = (errorCounts[msg] || 0) + 1;
    });

    console.log('\n\n🔍 DIAGNOSTIC REPORT (Failed Orders):');
    console.log('-----------------------------------');
    Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .forEach(([msg, count]) => {
            console.log(`[${count}x] ${msg}`);
        });
    console.log('-----------------------------------');
    console.log(`TOTAL FAILED: ${data.length}`);
}

diagnose();
