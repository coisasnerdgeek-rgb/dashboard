/**
 * Deletar registros completed antigos da fila de retry
 * Mantém apenas os últimos 7 dias para histórico
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

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function deleteOldCompleted() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🗑️  Deletando Registros Completed Antigos\n');
    console.log('='.repeat(60) + '\n');

    // Data de corte: 7 dias atrás
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutOffDate = sevenDaysAgo.toISOString();

    console.log(`📅 Data de corte: ${cutOffDate}`);
    console.log(`   (Registros COMPLETED antes dessa data serão deletados)\n`);

    // Contar registros a deletar
    const { count: toDeleteCount } = await supabase
        .from('webhook_retry_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .lt('created_at', cutOffDate);

    console.log(`📊 Registros a deletar: ${toDeleteCount || 0}\n`);

    if (!toDeleteCount || toDeleteCount === 0) {
        console.log('✅ Nenhum registro antigo a deletar!\n');
        return;
    }

    console.log('🔄 Deletando registros em lotes...\n');

    let totalDeleted = 0;
    const batchSize = 1000;

    while (true) {
        // Deletar em lotes de 1000
        const { count, error } = await supabase
            .from('webhook_retry_queue')
            .delete({ count: 'exact' })
            .eq('status', 'completed')
            .lt('created_at', cutOffDate)
            .limit(batchSize);

        if (error) {
            console.error('❌ Erro ao deletar:', error);
            break;
        }

        const deleted = count || 0;
        totalDeleted += deleted;

        console.log(`   Deletados: ${totalDeleted}/${toDeleteCount}`);

        if (deleted < batchSize) {
            // Não há mais registros para deletar
            break;
        }

        // Pequeno delay entre lotes
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🎯 RESUMO:\n');
    console.log(`   ✅ Total deletado: ${totalDeleted}`);

    // Estatísticas finais
    console.log('\n📊 Estatísticas Atuais da Fila:\n');

    const { count: totalPending } = await supabase
        .from('webhook_retry_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    const { count: totalCompleted } = await supabase
        .from('webhook_retry_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed');

    const { count: totalFailed } = await supabase
        .from('webhook_retry_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed');

    const total = (totalPending || 0) + (totalCompleted || 0) + (totalFailed || 0);

    console.log(`   ⏳ Pendentes: ${totalPending || 0}`);
    console.log(`   ✅ Completados (últimos 7 dias): ${totalCompleted || 0}`);
    console.log(`   ❌ Falhados: ${totalFailed || 0}`);
    console.log(`   📊 Total: ${total}\n`);

    console.log('✅ Limpeza concluída! Fila otimizada.\n');
}

deleteOldCompleted().catch(console.error);
