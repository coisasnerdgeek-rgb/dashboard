
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env: any = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .limit(3);

    if (error) {
        console.error(error);
        return;
    }

    console.log('\n📦 Amostras do Banco Novo (FULL JSON):\n');
    data.forEach((item, idx) => {
        console.log(`--- Amostra #${idx + 1} ---`);
        console.log(JSON.stringify(item.row_data, null, 2));
    });
}

check();
