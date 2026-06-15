
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env.local reader
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
try {
    envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
    console.error('❌ Could not read .env.local');
    process.exit(1);
}

const vars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, ...valParts] = line.split('=');
    if (key && valParts.length > 0) {
        vars[key.trim()] = valParts.join('=').trim();
    }
});

const SUPABASE_URL = vars['SUPABASE_URL'] || vars['VITE_SUPABASE_URL'];
const SUPABASE_KEY = vars['SUPABASE_SERVICE_ROLE_KEY'] || vars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
    console.log('🔍 Debugging Supabase JSON Query...');

    // 1. Fetch ONE row to see what the data looks like
    const { data: sample, error: sampleError } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .limit(1)
        .single();

    if (sampleError) {
        console.error('❌ Error fetching sample:', sampleError);
        return;
    }

    if (!sample) {
        console.log('⚠️ No data in spreadsheet_data table.');
        return;
    }

    const tinyId = sample.row_data['ID Tiny'] || sample.row_data['id_tiny'];
    console.log('📄 Sample Row ID Tiny:', tinyId);
    console.log('📄 Keys in row_data:', Object.keys(sample.row_data));

    if (!tinyId) {
        console.log('❌ Sample row does not have "ID Tiny" or "id_tiny"');
        return;
    }

    // 2. Try the EXACT query from sync-tiny.ts
    console.log(`\n🧪 Testing Query: .in('row_data->>ID Tiny', ['${tinyId}']) ...`);

    const { data: test1, error: error1 } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .in('row_data->>ID Tiny', [String(tinyId)]);

    if (error1) {
        console.error('❌ Query 1 Failed:', error1);
    } else {
        console.log(`✅ Query 1 Result: Found ${test1?.length} rows.`);
    }

    if (!test1 || test1.length === 0) {
        console.log('❌ FAILURE: The query syntax used in sync-tiny.ts is returning 0 results for an ID that EXISTS.');
    } else {
        console.log('✅ SUCCESS: The query finds the row correctly.');
    }
}

debug();
