/**
 * Verificar estrutura da tabela webhook_retry_queue
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

async function checkTableStructure() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔍 Verificando estrutura da tabela webhook_retry_queue\n');

    const { data, error } = await supabase
        .from('webhook_retry_queue')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Erro:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Colunas disponíveis:');
        console.log(Object.keys(data[0]));
    }

    console.log('\n');
}

checkTableStructure().catch(console.error);
