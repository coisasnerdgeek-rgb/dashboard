import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

const TINY_TOKEN_MVF = '92caca96c3109a90a20286888c3a504353bb8f8e'; // Pegunto do log anterior ou env

async function testFix() {
    const orderId = '260123SCKMA09H';
    const idTiny = '946056111';

    console.log(`🧪 Testando correção para o pedido ${orderId}...`);

    // 1. Buscar status atual no Tiny
    console.log('📡 Buscando status atual no Tiny ERP...');
    const response = await fetch(`https://api.tiny.com.br/api2/pedido.obter.php?token=${TINY_TOKEN_MVF}&id=${idTiny}&formato=json`);
    const tinyData = await response.json();
    const currentStatus = tinyData.retorno.pedido.situacao;
    console.log(`✅ Status no Tiny: ${currentStatus}`);

    // 2. Buscar itens no Supabase
    const { data: existingRows } = await supabase
        .from('spreadsheet_data')
        .select('id, row_data')
        .eq('row_data->>ID Tiny', idTiny);

    if (!existingRows || existingRows.length === 0) {
        console.log('❌ Pedido não encontrado no banco novo.');
        return;
    }

    console.log(`📊 Encontrados ${existingRows.length} itens no banco.`);

    // 3. Aplicar a lógica de atualização (igual ao que pus no process-retry-queue)
    console.log('🔄 Aplicando correção de status...');
    for (const row of existingRows) {
        if (row.row_data["Situação"] !== currentStatus) {
            const { error } = await supabase
                .from('spreadsheet_data')
                .update({
                    row_data: { ...row.row_data, "Situação": currentStatus },
                    updated_at: new Date().toISOString()
                })
                .eq('id', row.id);

            if (error) console.error('Erro na atualização:', error);
            else console.log(`✅ Item ${row.id} atualizado para ${currentStatus}`);
        } else {
            console.log(`ℹ️ Item ${row.id} já está com status ${currentStatus}`);
        }
    }

    console.log('✨ Teste finalizado!');
}

testFix();
