import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function forceOrderReprocess() {
    const orderId = '260123SCKMA09H';
    console.log(`🚀 Forçando reprocessamento do pedido ${orderId}...`);

    // 1. Deletar da fila de retry se existir (para reinserir limpo)
    await supabase.from('webhook_retry_queue').delete().eq('order_id', orderId);

    // 2. Inserir na fila como pendente
    const { error } = await supabase.from('webhook_retry_queue').insert({
        order_id: orderId,
        company: 'MVF', // O log anterior mostrou MVF
        status: 'pending',
        retry_count: 0,
        max_retries: 5,
        next_retry_at: new Date().toISOString(),
        payload: { cnpj: '25116514000138', origin: 'Manual Force Fix' }
    });

    if (error) {
        console.error('❌ Erro ao inserir na fila:', error);
    } else {
        console.log('✅ Pedido adicionado à fila com sucesso!');
        console.log('⏳ Agora chamando o processador de fila...');

        // Chamar o processador (via API local ou remota)
        const response = await fetch('https://dashboard-pedidos.vercel.app/api/process-retry-queue');
        const result = await response.json();
        console.log('📊 Resultado do processamento:', result);
    }
}

forceOrderReprocess();
