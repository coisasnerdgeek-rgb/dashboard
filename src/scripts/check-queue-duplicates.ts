/**
 * Verificar duplicatas na fila de retry
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

async function checkDuplicates() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔍 Verificando duplicatas na fila...\n');

    const { data } = await supabase
        .from('webhook_retry_queue')
        .select('order_id, id, status')
        .eq('status', 'pending');

    if (!data) return;

    const counts: Record<string, number> = {};
    data.forEach(item => {
        counts[item.order_id] = (counts[item.order_id] || 0) + 1;
    });

    const duplicates = Object.entries(counts).filter(([_, count]) => count > 1);

    console.log(`Total pendentes: ${data.length}`);
    console.log(`IDs únicos com duplicatas: ${duplicates.length}`);

    if (duplicates.length > 0) {
        console.log('Exemplos:', duplicates.slice(0, 5));

        // Opcional: remover duplicatas
        console.log('\n🗑️  Removendo duplicatas (mantendo apenas o mais recente)...');

        for (const [orderId, count] of duplicates) {
            // Buscar todas as entradas para esse orderId
            const entries = data.filter(d => d.order_id === orderId);
            // Manter apenas o último (maior ID ou created_at)
            // Assumindo ID incremental ou aleatório, created_at seria melhor, mas aqui tenho só ID
            // Vou manter o primeiro e deletar o resto
            const toKeep = entries[0];
            const toDelete = entries.slice(1);

            const idsToDelete = toDelete.map(d => d.id);

            if (idsToDelete.length > 0) {
                await supabase.from('webhook_retry_queue').delete().in('id', idsToDelete);
                process.stdout.write('.');
            }
        }
        console.log('\n✅ Duplicatas removidas.');
    } else {
        console.log('✅ Sem duplicatas.');
    }
}

checkDuplicates().catch(console.error);
