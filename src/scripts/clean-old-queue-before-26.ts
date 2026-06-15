/**
 * LIMPAR FILA DE RETRY - Manter apenas pedidos do dia 26/01 em diante
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

async function cleanOldQueue() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🧹 LIMPANDO FILA DE RETRY\n');
    console.log('='.repeat(60) + '\n');

    // Data de corte: 26/01/2026
    const cutoffDate = '2026-01-26';
    const cutoffDateBr = '26/01/2026';

    console.log(`📅 Mantendo apenas pedidos de ${cutoffDateBr} em diante\n`);

    // Verificar total atual
    const { count: totalBefore } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true });

    console.log(`   Total atual na fila: ${totalBefore || 0}\n`);

    // ESTRATÉGIA: Deletar em 2 passos

    // PASSO 1: Deletar pedidos com order_date antes de 26/01/2026
    console.log('🗑️  PASSO 1: Deletando pedidos com data antiga...\n');

    const { count: deletedByDate } = await supabase
        .from('webhook_retry_queue')
        .delete({ count: 'exact' })
        .lt('order_date', cutoffDate);

    console.log(`   ✅ Deletados por order_date: ${deletedByDate || 0}\n`);

    // PASSO 2: Deletar pedidos SEM order_date e criados há mais de 7 dias
    console.log('🗑️  PASSO 2: Deletando pedidos sem data (antigos)...\n');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: deletedNoDate } = await supabase
        .from('webhook_retry_queue')
        .delete({ count: 'exact' })
        .is('order_date', null)
        .lt('created_at', sevenDaysAgo.toISOString());

    console.log(`   ✅ Deletados sem data: ${deletedNoDate || 0}\n`);

    // PASSO 3: Verificar quantos restaram
    const { count: totalAfter } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true });

    console.log('='.repeat(60));
    console.log('\n📊 RESUMO:\n');
    console.log(`   Antes: ${totalBefore || 0} pedidos`);
    console.log(`   Deletados: ${(deletedByDate || 0) + (deletedNoDate || 0)} pedidos`);
    console.log(`   Restantes: ${totalAfter || 0} pedidos`);

    console.log('\n✅ Fila limpa! Agora clique em "Atualizar Status" no site.\n');
}

cleanOldQueue().catch(console.error);
