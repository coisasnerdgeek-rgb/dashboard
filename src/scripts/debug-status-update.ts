/**
 * Script para debugar atualização de status de pedidos
 * Verifica se um pedido específico está sendo atualizado corretamente
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
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM || process.env.TINY_API_TOKEN;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF;

async function debugOrder(ecommerceId: string) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log(`\n🔍 Debugging order: ${ecommerceId}\n`);

    // 1. Verificar no banco de dados
    console.log('📊 Checking database...');
    const { data: dbRows, error: dbError } = await supabase
        .from('spreadsheet_data')
        .select('id, row_data, updated_at')
        .or(`row_data->>Número da ordem de compra.eq.${ecommerceId},row_data->>Identificador do pedido e-commerce.eq.${ecommerceId}`);

    if (dbError) {
        console.error('❌ DB Error:', dbError);
        return;
    }

    if (!dbRows || dbRows.length === 0) {
        console.log('⚠️  Order not found in database');
        return;
    }

    console.log(`✅ Found ${dbRows.length} rows in database:`);
    dbRows.forEach((row, idx) => {
        console.log(`\n  Row ${idx + 1}:`);
        console.log(`    ID: ${row.id}`);
        console.log(`    Status: ${row.row_data['Situação'] || row.row_data['situacao']}`);
        console.log(`    SKU: ${row.row_data['SKU']}`);
        console.log(`    ID Tiny: ${row.row_data['ID Tiny']}`);
        console.log(`    Last Updated: ${row.updated_at}`);
    });

    const tinyId = dbRows[0]?.row_data['ID Tiny'];
    if (!tinyId) {
        console.log('\n⚠️  No Tiny ID found in database');
        return;
    }

    // 2. Verificar no Tiny API
    console.log(`\n🌐 Fetching from Tiny API (ID: ${tinyId})...`);

    let apiStatus = null;
    let foundInCompany = null;

    // Tentar MM primeiro
    if (TINY_TOKEN_MM) {
        try {
            const response = await fetch(`https://api.tiny.com.br/api2/pedido.obter.php?token=${TINY_TOKEN_MM}&id=${tinyId}&formato=json`);
            const data = await response.json();
            if (data.retorno?.status === 'OK') {
                apiStatus = data.retorno.pedido.situacao;
                foundInCompany = 'MM';
                console.log(`✅ Found in MM: Status = "${apiStatus}"`);
            }
        } catch (e) {
            console.log('⚠️  Not found in MM');
        }
    }

    // Tentar MVF se não encontrou em MM
    if (!apiStatus && TINY_TOKEN_MVF) {
        try {
            const response = await fetch(`https://api.tiny.com.br/api2/pedido.obter.php?token=${TINY_TOKEN_MVF}&id=${tinyId}&formato=json`);
            const data = await response.json();
            if (data.retorno?.status === 'OK') {
                apiStatus = data.retorno.pedido.situacao;
                foundInCompany = 'MVF';
                console.log(`✅ Found in MVF: Status = "${apiStatus}"`);
            }
        } catch (e) {
            console.log('⚠️  Not found in MVF');
        }
    }

    if (!apiStatus) {
        console.log('\n❌ Order not found in Tiny API');
        return;
    }

    // 3. Comparar status
    const dbStatus = dbRows[0].row_data['Situação'] || dbRows[0].row_data['situacao'];
    console.log(`\n📊 Status Comparison:`);
    console.log(`   Database: "${dbStatus}"`);
    console.log(`   Tiny API: "${apiStatus}"`);

    if (dbStatus.toLowerCase().trim() === apiStatus.toLowerCase().trim()) {
        console.log(`\n✅ Status is UP TO DATE`);
    } else {
        console.log(`\n⚠️  STATUS MISMATCH DETECTED!`);
        console.log(`   This order needs to be updated.`);

        // 4. Verificar fila de retry
        console.log(`\n🔍 Checking retry queue...`);
        const { data: queueData } = await supabase
            .from('webhook_retry_queue')
            .select('*')
            .eq('order_id', tinyId);

        if (queueData && queueData.length > 0) {
            console.log(`\n📋 Found in retry queue:`);
            queueData.forEach((item, idx) => {
                console.log(`\n  Queue Item ${idx + 1}:`);
                console.log(`    Status: ${item.status}`);
                console.log(`    Retry Count: ${item.retry_count}`);
                console.log(`    Last Error: ${item.last_error || 'None'}`);
                console.log(`    Next Retry: ${item.next_retry_at}`);
            });
        } else {
            console.log(`\n⚠️  Not found in retry queue - needs to be added!`);

            // 5. Adicionar à fila
            console.log(`\n➕ Adding to retry queue...`);
            const { error: insertError } = await supabase
                .from('webhook_retry_queue')
                .insert({
                    order_id: tinyId,
                    company: foundInCompany,
                    status: 'pending',
                    retry_count: 0,
                    max_retries: 5,
                    next_retry_at: new Date().toISOString(),
                    payload: { cnpj: dbRows[0].row_data['CNPJ'], origin: 'Manual Debug' }
                });

            if (insertError) {
                console.error(`\n❌ Failed to add to queue:`, insertError);
            } else {
                console.log(`\n✅ Successfully added to retry queue!`);
                console.log(`   The status will be updated in the next processing cycle (within 1 minute)`);
            }
        }
    }

    console.log(`\n${'='.repeat(60)}\n`);
}

// Execute
const orderId = process.argv[2] || '260124SWV0K6W7';
debugOrder(orderId).catch(console.error);
