import { createClient } from '@supabase/supabase-js';
import { fetchTinyOrder } from '../services/tinyService';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM || process.env.TINY_API_TOKEN;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { ids } = req.body; // Expects an array of { id: string | number, cnpj: string }

    if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'Invalid input. Expected "ids" array.' });
    }

    if (ids.length > 50) {
        return res.status(400).json({ error: 'Batch size too large. Max 50 items.' });
    }

    console.log(`[RefreshStatus] Refreshing ${ids.length} orders...`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const updates: any[] = [];

    // Process in parallel with limit
    // Note: Tiny API rate limits might apply, so we process serially or in small chunks if needed.
    // fetchTinyOrder is robust but we should be careful.

    for (const item of ids) {
        const orderId = String(item.id);
        const cnpj = item.cnpj;

        let token = TINY_TOKEN_MM;
        if (cnpj === '25116514000138' || String(cnpj).includes('25116514')) {
            token = TINY_TOKEN_MVF;
        }

        if (!token) {
            console.warn(`[RefreshStatus] No token found for CNPJ ${cnpj}`);
            continue;
        }

        const tinyOrder = await fetchTinyOrder(orderId, token);

        if (tinyOrder) {
            const newStatus = tinyOrder.situacao;
            // Update Supabase
            // We need to find the row by unique ID or some other identifier.
            // Assuming we have the database ID or we search by order ID?
            // The item.id passed here *should* be the order ID (idVenda), not the Supabase row ID,
            // because fetchTinyOrder needs the generic ID.

            // However, to update Supabase 'spreadsheet_data', we need to match the row.
            // Let's assume the frontend passes the order ID.
            // We need to update ALL rows with this ID?
            // Actually, querying spreadsheet_data by order ID (json query) is slow.
            // Ideally frontend passes { id: orderId, supabaseId: string }?

            // Let's rely on the frontend sending { orderId: '123', supabaseId: 'uuid', cnpj: '...' }
            // If supabaseId is provided, we update that specific row.

            if (item.supabaseId) {
                // Fetch current row to merge
                const { data: currentRow } = await supabase
                    .from('spreadsheet_data')
                    .select('row_data')
                    .eq('id', item.supabaseId)
                    .single();

                if (currentRow) {
                    const updatedRowData = { ...currentRow.row_data };
                    // Atualiza ambas as chaves para garantir compatibilidade histórica e normalização correta
                    updatedRowData["Situação"] = newStatus;
                    updatedRowData["situacao"] = newStatus;

                    const { error } = await supabase
                        .from('spreadsheet_data')
                        .update({ row_data: updatedRowData })
                        .eq('id', item.supabaseId);

                    if (!error) {
                        updates.push({ id: item.supabaseId, status: newStatus, orderId });
                    }
                }
            }
        }
    }

    return res.status(200).json({
        message: `Processed ${ids.length} orders`,
        updated: updates.length,
        details: updates
    });
}
