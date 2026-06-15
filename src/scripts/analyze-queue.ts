/**
 * Script detalhado para analisar fila de retry
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

async function analyzeQueue() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n📊 Análise Detalhada da Fila de Retry\n');
    console.log('='.repeat(60) + '\n');

    // Get all items
    const { data: allItems } = await supabase
        .from('webhook_retry_queue')
        .select('*')
        .order('created_at', { ascending: false });

    if (!allItems || allItems.length === 0) {
        console.log('✅ Fila vazia!\n');
        return;
    }

    // Count by status
    const byStatus = allItems.reduce((acc: any, item: any) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
    }, {});

    console.log('📈 Resumo por Status:');
    Object.entries(byStatus).forEach(([status, count]) => {
        const emoji = status === 'pending' ? '⏳' : status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄';
        console.log(`   ${emoji} ${status}: ${count}`);
    });

    // Pending items by age
    const now = new Date();
    const pending = allItems.filter(i => i.status === 'pending');

    if (pending.length > 0) {
        console.log(`\n⏳ Pedidos Pendentes (${pending.length}):\n`);

        const ageGroups = {
            'Hoje': 0,
            'Ontem': 0,
            '2-7 dias': 0,
            '8-30 dias': 0,
            '30+ dias': 0
        };

        pending.forEach(item => {
            const createdAt = new Date(item.created_at);
            const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) ageGroups['Hoje']++;
            else if (diffDays === 1) ageGroups['Ontem']++;
            else if (diffDays <= 7) ageGroups['2-7 dias']++;
            else if (diffDays <= 30) ageGroups['8-30 dias']++;
            else ageGroups['30+ dias']++;
        });

        Object.entries(ageGroups).forEach(([age, count]) => {
            if (count > 0) {
                console.log(`   ${age}: ${count} pedidos`);
            }
        });

        // Show oldest pending
        const oldest = pending.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )[0];

        if (oldest) {
            const age = Math.floor((now.getTime() - new Date(oldest.created_at).getTime()) / (1000 * 60 * 60 * 24));
            console.log(`\n   📅 Mais antigo: ${oldest.order_id} (${age} dias atrás)`);
        }
    }

    // Failed items
    const failed = allItems.filter(i => i.status === 'failed');
    if (failed.length > 0) {
        console.log(`\n❌ Pedidos Falhados (${failed.length}):\n`);

        const errorGroups: any = {};
        failed.forEach(item => {
            const error = item.last_error || 'Erro desconhecido';
            const shortError = error.substring(0, 50);
            errorGroups[shortError] = (errorGroups[shortError] || 0) + 1;
        });

        Object.entries(errorGroups)
            .sort((a: any, b: any) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([error, count]) => {
                console.log(`   ${count}x: ${error}...`);
            });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 Recomendações:\n');

    if (pending.length > 1000) {
        console.log('   ⚠️  Fila muito grande (>1000 itens)');
        console.log('   • Deixe o processamento rodar até finalizar');
        console.log('   • Evite adicionar mais pedidos agora');
    } else if (pending.length > 100) {
        console.log('   ✅ Fila com volume moderado');
        console.log('   • Processamento deve levar alguns minutos');
    } else {
        console.log('   ✅ Fila pequena');
        console.log('   • Processamento rápido');
    }

    if (failed.length > 50) {
        console.log('\n   ⚠️  Muitos pedidos falhados');
        console.log('   • Revise erros com: npx tsx scripts/debug-status-update.ts [ID]');
    }

    console.log('\n');
}

analyzeQueue().catch(console.error);
