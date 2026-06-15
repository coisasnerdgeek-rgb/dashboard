/**
 * Verificar de onde vem a informação da loja nos pedidos
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

async function checkStoreInfo() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔍 Verificando Informação de Loja\n');
    console.log('='.repeat(60) + '\n');

    // Buscar um pedido do dia 28 com loja incorreta
    const { data: samples } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .eq('row_data->>Data', '28/01/2026')
        .limit(5);

    if (samples && samples.length > 0) {
        console.log('📦 Amostras de pedidos com LOJA INCORRETA:\n');
        samples.forEach((row: any, idx: number) => {
            console.log(`${idx + 1}. ID Tiny: ${row.row_data['ID Tiny']}`);
            console.log(`   Loja atual: "${row.row_data['Loja']}"`);
            console.log(`   Observações: "${row.row_data['Observações']?.substring(0, 100)}..."`);
            console.log(`   Obs Internas: "${row.row_data['Observações Internas']?.substring(0, 100)}..."`);
            console.log('');
        });

        // Buscar detalhes completos de um pedido do Tiny para ver estrutura
        const sampleId = samples[0].row_data['ID Tiny'];
        console.log(`📡 Buscando estrutura completa do pedido #${sampleId} no Tiny...\n`);

        const response = await fetch(
            `https://api.tiny.com.br/api2/pedido.obter.php?token=${TINY_TOKEN_MM}&id=${sampleId}&formato=JSON`
        );
        const data = await response.json();

        if (data.retorno?.status === 'OK') {
            const pedido = data.retorno.pedido;
            console.log('Campos disponíveis:');
            console.log(`   nome_vendedor: "${pedido.nome_vendedor}"`);
            console.log(`   id_vendedor: "${pedido.id_vendedor}"`);
            console.log(`   ecommerce.numero_loja: "${pedido.ecommerce?.numero_loja}"`);
            console.log(`   obs: "${pedido.obs?.substring(0, 100)}..."`);
            console.log(`   obs_interna: "${pedido.obs_interna?.substring(0, 100)}..."`);
            console.log('');
        }
    }

    // Buscar pedidos ANTIGOS com loja CORRETA para comparar
    console.log('\n📦 Amostras de pedidos ANTIGOS com loja CORRETA:\n');

    const { data: oldSamples } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .or('row_data->>Loja.ilike.%SH MM%,row_data->>Loja.ilike.%ML MM%,row_data->>Loja.ilike.%NG MM%')
        .limit(5);

    if (oldSamples && oldSamples.length > 0) {
        oldSamples.forEach((row: any, idx: number) => {
            console.log(`${idx + 1}. ID Tiny: ${row.row_data['ID Tiny']}`);
            console.log(`   Loja: "${row.row_data['Loja']}"`);
            console.log(`   Data: ${row.row_data['Data']}`);
            console.log('');
        });
    }

    console.log('='.repeat(60) + '\n');
}

checkStoreInfo().catch(console.error);
