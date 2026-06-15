import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function inspectOrder() {
    const orderId = '260123SCKMA09H';
    console.log(`🔍 Inspecionando pedido: ${orderId}...`);

    // Procurar em spreadsheet_data
    const { data: spreadsheet, error: sError } = await newSupabase
        .from('spreadsheet_data')
        .select('*')
        .ilike('row_data->>Número da ordem de compra', `%${orderId}%`);

    console.log('--- spreadsheet_data ---');
    if (sError) {
        console.error(sError);
    } else if (spreadsheet && spreadsheet.length > 0) {
        spreadsheet.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`Status Banco: ${row.status}`);
            console.log(`Data Banco: ${JSON.stringify(row.row_data, null, 2)}`);
            console.log(`Updated At: ${row.updated_at}`);
            console.log('---');
        });
    } else {
        console.log('Não encontrado em spreadsheet_data por Número da ordem de compra.');

        // Tentar por ID exato se o formato for diferente
        const { data: s2 } = await newSupabase.from('spreadsheet_data').select('*').eq('id', orderId);
        if (s2 && s2.length > 0) console.log('Encontrado por ID exato:', s2[0]);
    }
}

inspectOrder();
