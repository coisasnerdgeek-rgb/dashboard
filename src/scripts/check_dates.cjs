
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

async function checkDates() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get 5 recent rows
    const { data, error } = await supabase
        .from('spreadsheet_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error(error);
        return;
    }

    console.log('\n\n📅 CHECKING DATE FORMATS (Recent 5):');
    data.forEach(row => {
        // Log keys to see what matches
        const keys = Object.keys(row.row_data);
        console.log(`ID: ${row.id} | Keys: ${keys.slice(0, 5).join(', ')}...`);
        console.log(`FULL JSON (First Item):`, JSON.stringify(row.row_data, null, 2));
    });
}

checkDates();
