
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const token = process.env.TINY_API_TOKEN_MVF;

async function findTinyId() {
    const orderNumber = '260123SCKMA09H';
    console.log(`🔍 Buscando ID Tiny para o pedido: ${orderNumber}...`);

    try {
        const response = await fetch('https://api.tiny.com.br/api2/pedidos.pesquisa.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `token=${token}&numeroEcommerce=${orderNumber}&formato=json`
        });

        const raw = await response.json();
        const data = raw.retorno;
        if (data.status === 'OK' && data.pedidos && data.pedidos.length > 0) {
            const pedidoTiny = data.pedidos[0].pedido;
            const tinyId = pedidoTiny.id;
            const statusTiny = pedidoTiny.situacao;
            console.log(`✅ ID Tiny encontrado: ${tinyId}`);
            console.log(`📡 Status no Tiny: ${statusTiny}`);

            // Agora verificar se já existe no banco
            const { data: dbRows } = await supabase
                .from('spreadsheet_data')
                .select('id, row_data, updated_at')
                .eq('row_data->>ID Tiny', String(tinyId));

            console.log('--- No Banco de Dados ---');
            if (dbRows && dbRows.length > 0) {
                dbRows.forEach(r => {
                    console.log(`- ID: ${r.id}`);
                    console.log(`  Situação Atual: ${r.row_data["Situação"]}`);
                    console.log(`  Updated At: ${r.updated_at}`);
                });
            } else {
                console.log('❌ Nenhum registro encontrado com esse ID Tiny.');
            }
        } else {
            console.log('⚠️ Pedido não encontrado no Tiny.');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (error: any) {
        console.error('❌ Erro:', error.message);
    }
}

findTinyId();
