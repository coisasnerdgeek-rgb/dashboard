
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

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function syncPeriod() {
    console.log('\n🚀 Iniciando Sincronização Prioritária (26 a 30 de Janeiro)\n');

    // Chamando a API de sync localmente
    const url = 'http://localhost:3000/api/sync-tiny';

    try {
        console.log('📡 Solicitando descoberta de pedidos (últimos 7 dias)...');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ daysBack: 7, forceReprocess: true })
        });

        const result = await response.json();
        console.log('✅ Descoberta concluída:', result.stats);

        if (result.stats.added > 0) {
            console.log(`\n⚡ Processando ${result.stats.added} novos pedidos da fila...`);
            // Chama o processador turbo
            const { execSync } = require('child_process');
            execSync('npx tsx scripts/process-queue-turbo.ts http://localhost:3000', { stdio: 'inherit' });
        } else {
            console.log('\n✨ Nenhum pedido novo encontrado para este período (já sincronizados).');
        }

    } catch (error: any) {
        console.error('❌ Erro na sincronização:', error.message);
    }
}

syncPeriod();
