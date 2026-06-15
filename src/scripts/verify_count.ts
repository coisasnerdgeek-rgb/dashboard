
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function countOrders() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Count spreadsheet_data
    const { count, error } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error counting:', error);
    } else {
        console.log(`\n\n📊 TOTAL PEDIDOS NO BANCO DE DADOS: ${count}`);
    }
}

countOrders();
