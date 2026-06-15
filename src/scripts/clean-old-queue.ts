/**
 * Limpar fila antiga de retry
 * Remove/marca como completed pedidos antigos que já foram processados
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

async function cleanOldQueue() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🧹 Limpando Fila Antiga de Retry\n');
    console.log('='.repeat(60) + '\n');

    // Data de corte: 7 dias atrás
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutOffDate = sevenDaysAgo.toISOString();

    console.log(`📅 Data de corte: ${cutOffDate}`);
    console.log(`   (Pedidos adicionados à fila ANTES dessa data serão verificados)\n`);

    // Buscar pedidos antigos pendentes
    console.log('🔍 Buscando pedidos antigos pendentes...\n');

    const { data: oldPending, error, count } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact' })
        .eq('status', 'pending')
        .lt('created_at', cutOffDate)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('❌ Erro:', error);
        return;
    }

    if (!oldPending || oldPending.length === 0) {
        console.log('✅ Nenhum pedido antigo pendente encontrado!\n');
        return;
    }

    console.log(`📊 Encontrados ${count} pedidos antigos pendentes\n`);

    // Agrupar por idade
    const now = new Date();
    const ageGroups = {
        '7-14 dias': 0,
        '15-30 dias': 0,
        '30-60 dias': 0,
        '60+ dias': 0
    };

    oldPending.forEach(item => {
        const created = new Date(item.created_at);
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 14) ageGroups['7-14 dias']++;
        else if (diffDays <= 30) ageGroups['15-30 dias']++;
        else if (diffDays <= 60) ageGroups['30-60 dias']++;
        else ageGroups['60+ dias']++;
    });

    console.log('📈 Distribuição por idade:');
    Object.entries(ageGroups).forEach(([age, count]) => {
        if (count > 0) {
            console.log(`   ${age}: ${count} pedidos`);
        }
    });

    console.log('\n' + '-'.repeat(60) + '\n');

    // Processar em lotes
    console.log('🔄 Verificando quais já foram importados...\n');

    let markedAsCompleted = 0;
    let alreadyCompleted = 0;
    let genuinelyPending = 0;

    const batchSize = 100;
    for (let i = 0; i < oldPending.length; i += batchSize) {
        const batch = oldPending.slice(i, i + batchSize);
        const orderIds = batch.map(item => item.order_id);

        // Verificar quais já existem no banco
        const { data: existing } = await supabase
            .from('spreadsheet_data')
            .select('row_data')
            .in('row_data->>ID Tiny', orderIds);

        const existingIds = new Set(existing?.map((r: any) => String(r.row_data['ID Tiny'])) || []);

        // Marcar como completed os que já foram importados
        for (const item of batch) {
            if (existingIds.has(item.order_id)) {
                const { error: updateError } = await supabase
                    .from('webhook_retry_queue')
                    .update({ status: 'completed' })
                    .eq('id', item.id);

                if (!updateError) {
                    markedAsCompleted++;
                } else {
                    alreadyCompleted++;
                }
            } else {
                genuinelyPending++;
            }
        }

        // Log de progresso
        const progress = Math.min(i + batchSize, oldPending.length);
        console.log(`   Processados: ${progress}/${oldPending.length} | Marcados: ${markedAsCompleted} | Realmente pendentes: ${genuinelyPending}`);
    }

    console.log('\n' + '-'.repeat(60) + '\n');

    // Limpar pedidos failed antigos (opcionalmente)
    console.log('🗑️  Verificando pedidos falhados para limpeza...\n');

    const { data: oldFailed, count: failedCount } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact' })
        .eq('status', 'failed')
        .lt('created_at', cutOffDate);

    if (oldFailed && oldFailed.length > 0) {
        console.log(`   Encontrados ${failedCount} pedidos falhados antigos`);
        console.log(`   (Mantidos para análise - não deletados)\n`);
    }

    // Resumo final
    console.log('='.repeat(60));
    console.log('\n🎯 RESUMO DA LIMPEZA:\n');
    console.log(`   ✅ Marcados como completed: ${markedAsCompleted}`);
    console.log(`   ⚠️  Realmente pendentes (não importados): ${genuinelyPending}`);
    console.log(`   ℹ️  Pedidos falhados antigos: ${failedCount || 0} (mantidos)\n`);

    // Estatísticas finais da fila
    console.log('📊 Estatísticas Atuais da Fila:\n');

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

    console.log(`   ⏳ Pendentes: ${totalPending || 0}`);
    console.log(`   ✅ Completados: ${totalCompleted || 0}`);
    console.log(`   ❌ Falhados: ${totalFailed || 0}\n`);

    if (genuinelyPending > 0) {
        console.log('💡 Recomendação:\n');
        console.log(`   Há ${genuinelyPending} pedidos antigos que nunca foram importados.`);
        console.log(`   Você pode:\n`);
        console.log(`   1. Deixar como estão (não afetam novos pedidos)`);
        console.log(`   2. Processar manualmente com: npx tsx scripts/process-queue-manual.ts`);
        console.log(`   3. Deletá-los se não forem mais necessários\n`);
    }

    console.log('✅ Limpeza concluída!\n');
}

cleanOldQueue().catch(console.error);
