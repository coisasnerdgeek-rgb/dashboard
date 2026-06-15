/**
 * Script para processar fila manualmente (sem depender do cron)
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

const API_URL = 'https://dashboard-pedidos.vercel.app';

async function processQueue() {
    console.log('\n⚡ Processando Fila de Retry Manualmente\n');
    console.log('='.repeat(60) + '\n');

    let totalProcessed = 0;
    let totalFailed = 0;
    let iteration = 0;

    while (true) {
        iteration++;
        console.log(`\n📦 Iteração ${iteration}...`);

        try {
            const response = await fetch(`${API_URL}/api/process-retry-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                console.error(`❌ Erro HTTP: ${response.status}`);
                break;
            }

            const data = await response.json();

            if (!data.success) {
                console.error(`❌ Erro: ${data.error}`);
                break;
            }

            const completed = data.completed || 0;
            const failed = data.failed || 0;
            const pending = data.pendingCount || 0;

            totalProcessed += completed;
            totalFailed += failed;

            console.log(`   ✅ Completados: ${completed}`);
            console.log(`   ❌ Falhados: ${failed}`);
            console.log(`   ⏳ Pendentes: ${pending}`);

            // Se não há mais pendentes ou nada foi processado, parar
            if (pending === 0 || (completed === 0 && failed === 0)) {
                console.log(`\n✅ Fila completamente processada!`);
                break;
            }

            // Delay entre iterações
            await new Promise(r => setTimeout(r, 500));

        } catch (error: any) {
            console.error(`❌ Erro na iteração:`, error.message);
            break;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎯 RESUMO FINAL:\n`);
    console.log(`   ✅ Total processados: ${totalProcessed}`);
    console.log(`   ❌ Total falhados: ${totalFailed}`);
    console.log(`\n`);
}

processQueue().catch(console.error);
