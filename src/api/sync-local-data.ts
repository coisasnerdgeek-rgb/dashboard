import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { data } = req.body;

        // DEBUG INFO COLLECTION
        const debugInfo: any = {
            bodyType: typeof req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            dataProvided: !!data,
            dataKeys: data ? Object.keys(data) : [],
            fileDetails: []
        };

        if (!data) {
            return res.status(400).json({ error: 'No data provided', debug: debugInfo });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        let totalInserted = 0;
        let errors = [];

        // Iterate over files in the data object
        for (const [filename, fileData] of Object.entries(data)) {
            const rows = (fileData as any).rows;
            const importDate = (fileData as any).importDate || new Date().toISOString();

            const fileDebug = {
                filename,
                hasRows: !!rows,
                isArray: Array.isArray(rows),
                count: Array.isArray(rows) ? rows.length : 0,
                importDate
            };
            debugInfo.fileDetails.push(fileDebug);

            if (!Array.isArray(rows)) continue;

            // Prepare rows for insertion
            const dbRows = rows.map((row: any) => ({
                filename: filename,
                row_data: row,
                import_date: importDate,
                created_at: new Date().toISOString()
            }));

            // Insert in batches of 50
            for (let i = 0; i < dbRows.length; i += 50) {
                const batch = dbRows.slice(i, i + 50);
                const { error } = await supabase.from('spreadsheet_data').insert(batch);

                if (error) {
                    console.error('Error inserting batch:', error);
                    errors.push(`${filename}: ${error.message}`);
                } else {
                    totalInserted += batch.length;
                }
            }
        }

        return res.status(200).json({
            message: 'Sync successful',
            inserted: totalInserted,
            errors: errors.length > 0 ? errors : undefined,
            debug: debugInfo
        });

    } catch (error) {
        console.error('Sync error:', error);
        return res.status(500).json({
            error: String(error),
            debug: {
                bodyType: typeof req.body,
                bodyKeys: req.body ? Object.keys(req.body) : []
            }
        });
    }
}
