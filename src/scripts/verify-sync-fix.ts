
import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function verifySyncLogic() {
    const orderId = '260123SCKMA09H';
    const forceReprocess = true;

    console.log(`🧪 Verificando status atual para pedido ${orderId}...`);

    const { data: queueItems } = await supabase
        .from('webhook_retry_queue')
        .select('status')
        .eq('order_id', orderId);

    const currentStatus = queueItems?.[0]?.status || 'não encontrado na fila';
    console.log(`Status atual na fila: ${currentStatus}`);

    // RESET PARA PENDING (Simulando o que o sync-tiny.ts agora fará)
    console.log('🔄 Resetando para pending para garantir atualização...');
    await supabase
        .from('webhook_retry_queue')
        .update({
            status: 'pending',
            retry_count: 0,
            next_retry_at: new Date().toISOString(),
            last_error: null
        })
        .eq('order_id', orderId);

    console.log('✅ Pronto! O processador de fila pegará este pedido na próxima execução.');
}

verifySyncLogic();
