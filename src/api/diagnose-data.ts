import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const results: any = {};

        // 1. Check spreadsheet_data
        const { count: spreadCount, data: spreadSample } = await supabase
            .from('spreadsheet_data')
            .select('*', { count: 'exact' })
            .limit(5);

        results.spreadsheet_data = {
            count: spreadCount,
            sample: spreadSample
        };

        // 2. Check saved_orders
        const { count: savedCount, data: savedSample } = await supabase
            .from('saved_orders')
            .select('*', { count: 'exact' })
            .limit(5);

        results.saved_orders = {
            count: savedCount,
            sample: savedSample
        };

        return res.status(200).json(results);
    } catch (error) {
        return res.status(500).json({ error: String(error) });
    }
}
