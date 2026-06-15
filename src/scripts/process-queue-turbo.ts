/**
 * Script TURBO para processar fila mais rapidamente
 * Chama API múltiplas vezes em paralelo
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

async function processQueueTurbo() {
    console.log('\n⚡⚡ PROCESSAMENTO TURBO DA FILA ⚡⚡\n');
    console.log('='.repeat(60) + '\n');

    let totalProcessed = 0;
    let totalFailed = 0;
    let round = 0;

    while (true) {
        round++;
        console.log(`\n🔥 Rodada ${round} - Chamando API 5x em paralelo...`);

        try {
            // Chamar API 5 vezes em paralelo para processar mais rápido
            const promises = Array(5).fill(null).map(() =>
                fetch(`${API_URL}/api/process-retry-queue`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }).then(r => r.json())
            );

            const results = await Promise.all(promises);

            let roundCompleted = 0;
            let roundFailed = 0;
            let minPending = Infinity;

            results.forEach((data, idx) => {
                if (data.success) {
                    roundCompleted += data.completed || 0;
                    roundFailed += data.failed || 0;
                    const pending = data.pendingCount || 0;
                    if (pending < minPending) minPending = pending;
                }
            });

            totalProcessed += roundCompleted;
            totalFailed += roundFailed;

            console.log(`   ✅ Completados nesta rodada: ${roundCompleted}`);
            console.log(`   ❌ Falhados nesta rodada: ${roundFailed}`);
            console.log(`   ⏳ Pendentes restantes: ${minPending}`);

            // Se não há mais pendentes ou nada foi processado, parar
            if (minPending === 0 || roundCompleted === 0) {
                console.log(`\n✅ Processamento completo!`);
                break;
            }

            // Se ainda há muitos pendentes, continuar sem delay
            // Se poucos, adicionar pequeno delay
            if (minPending < 50) {
                await new Promise(r => setTimeout(r, 2000));
            }

        } catch (error: any) {
            console.error(`❌ Erro na rodada:`, error.message);
            break;
        }

        // Limite de segurança: 20 rodadas
        if (round >= 20) {
            console.log(`\n⚠️  Atingido limite de 20 rodadas. Processamento pausado.`);
            break;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎯 RESUMO FINAL:\n`);
    console.log(`   ✅ Total processados: ${totalProcessed}`);
    console.log(`   ❌ Total falhados: ${totalFailed}`);
    console.log(`   🔥 Rodadas executadas: ${round}`);
    console.log(`\n`);
}

processQueueTurbo().catch(console.error);
