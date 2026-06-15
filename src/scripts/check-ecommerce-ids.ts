/**
 * Verificar Ecommerce IDs dos pedidos importados
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

async function checkEcommerceIds() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('\n🔍 Verificando Ecommerce IDs dos Pedidos\n');
    console.log('='.repeat(60) + '\n');

    // Buscar amostras de pedidos do dia 28
    const { data: samples } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .eq('row_data->>Data', '28/01/2026')
        .limit(10);

    if (!samples || samples.length === 0) {
        console.log('❌ Nenhum pedido encontrado!\n');
        return;
    }

    console.log('📦 Amostras de Pedidos do Dia 28:\n');

    for (const sample of samples) {
        const rowData = sample.row_data;
        console.log(`ID Tiny: ${rowData['ID Tiny']}`);
        console.log(`   Ecommerce ID: "${rowData['Ecommerce ID']}" ${!rowData['Ecommerce ID'] ? '❌ VAZIO!' : ''}`);
        console.log(`   Loja: "${rowData['Loja']}"`);
        console.log(`   Cliente: "${rowData['Cliente']?.substring(0, 30)}..."`);
        console.log('');
    }

    // Buscar diretamente do Tiny para comparar
    const sampleTinyId = samples[0].row_data['ID Tiny'];
    console.log(`📡 Buscando #${sampleTinyId} diretamente do Tiny...\n`);

    const response = await fetch(
        `https://api.tiny.com.br/api2/pedido.obter.php?token=${TINY_TOKEN_MM}&id=${sampleTinyId}&formato=JSON`
    );
    const data = await response.json();

    if (data.retorno?.status === 'OK') {
        const pedido = data.retorno.pedido;
        console.log('Dados do Tiny:');
        console.log(`   ID: ${pedido.id}`);
        console.log(`   Ecommerce numero: "${pedido.ecommerce?.numero_ecommerce}"`);
        console.log(`   Ecommerce numero_loja: "${pedido.ecommerce?.numero_loja}"`);
        console.log(`   Nome vendedor: "${pedido.nome_vendedor}"`);
        console.log(`   ID vendedor: "${pedido.id_vendedor}"`);
        console.log('');
    }

    // Verificar um pedido ANTIGO que tem loja correta
    console.log('📦 Comparando com Pedido Antigo (loja correta):\n');

    const { data: oldSample } = await supabase
        .from('spreadsheet_data')
        .select('row_data')
        .ilike('row_data->>Loja', '%SH MM%')
        .limit(1);

    if (oldSample && oldSample.length > 0) {
        const oldData = oldSample[0].row_data;
        console.log(`ID Tiny: ${oldData['ID Tiny']}`);
        console.log(`   Ecommerce ID: "${oldData['Ecommerce ID']}"`);
        console.log(`   Loja: "${oldData['Loja']}"`);
        console.log('');
    }

    console.log('='.repeat(60) + '\n');
}

checkEcommerceIds().catch(console.error);
