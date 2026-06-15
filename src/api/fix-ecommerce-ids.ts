import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM!;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF!;

async function fetchTinyOrder(token: string, id: string): Promise<any> {
    const url = `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${id}&formato=json`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.retorno && data.retorno.status === 'OK') {
            return data.retorno.pedido;
        }
    } catch (e) {
        console.error('Fetch exception:', e);
    }
    return null;
}

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        console.log('🔍 Searching for orders with incorrect IDs...');

        // Get rows to check
        const { data: rows, error: fetchError } = await supabase
            .from('spreadsheet_data')
            .select('id, row_data')
            .not('row_data->>ID Tiny', 'is', null)
            .limit(50);

        if (fetchError) throw fetchError;

        if (!rows || rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No rows found',
                fixed: 0
            });
        }

        // Filter rows that have problematic IDs
        const isProblematicId = (id: string) => {
            if (!id || id === 'undefined' || id === 'null' || id.trim() === '') return true;
            // Check if purely numeric and less than 100000 (likely internal Tiny ID)
            const num = parseInt(id, 10);
            return !isNaN(num) && num < 100000 && !/[A-Z]/.test(id);
        };

        const problematicRows = rows.filter(row => {
            const rowData = row.row_data as any;
            const ecomId = rowData['Identificador do pedido e-commerce'];
            return isProblematicId(ecomId);
        });

        console.log(`📦 Found ${rows.length} rows total, ${problematicRows.length} with problematic IDs`);

        if (problematicRows.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No rows to fix',
                fixed: 0
            });
        }

        console.log(`📦 Found ${rows.length} rows to check`);

        let fixed = 0;
        let notFound = 0;
        let errors = 0;

        for (const row of problematicRows) {
            const rowData = row.row_data as any;
            const tinyId = rowData['ID Tiny'];
            const company = rowData['Empresa'] || 'MM';

            if (!tinyId) {
                console.log(`  ⚠️ Row ${row.id} has no Tiny ID, skipping`);
                continue;
            }

            console.log(`  🔎 Checking Tiny ID: ${tinyId} (Company: ${company})`);

            try {
                const token = company === 'MVF' ? TINY_TOKEN_MVF : TINY_TOKEN_MM;
                const fullOrder = await fetchTinyOrder(token, tinyId);

                if (!fullOrder) {
                    console.log(`    ❌ Order not found in Tiny`);
                    notFound++;
                    continue;
                }

                const ecommerceId = fullOrder.numero_ecommerce || fullOrder.ecommerce?.numeroPedidoEcommerce || '';

                if (ecommerceId && ecommerceId !== rowData['Identificador do pedido e-commerce']) {
                    // Update the row
                    const updatedRowData = {
                        ...rowData,
                        'Número da ordem de compra': ecommerceId,
                        'Identificador do pedido e-commerce': ecommerceId
                    };

                    const { error: updateError } = await supabase
                        .from('spreadsheet_data')
                        .update({ row_data: updatedRowData })
                        .eq('id', row.id);

                    if (updateError) {
                        console.error(`    ❌ Update error:`, updateError);
                        errors++;
                    } else {
                        console.log(`    ✅ Fixed: ${rowData['Identificador do pedido e-commerce']} → ${ecommerceId}`);
                        fixed++;
                    }
                } else {
                    console.log(`    ℹ️ No ecommerce ID found in Tiny, keeping as is`);
                }

                // Rate limit
                await new Promise(r => setTimeout(r, 500));

            } catch (error: any) {
                console.error(`    💥 Error processing row ${row.id}:`, error.message);
                errors++;
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Fix completed',
            stats: {
                totalChecked: rows.length,
                totalProblematic: problematicRows.length,
                fixed,
                notFound,
                errors
            }
        });

    } catch (error: any) {
        console.error('Fix failed:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
