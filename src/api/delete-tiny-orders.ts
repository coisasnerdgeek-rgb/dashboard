import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed - use POST' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log('🗑️ Starting deletion of Tiny ERP Auto-Import orders...');

        // Delete all orders with filename "Tiny ERP Auto-Import"
        const { error, count } = await supabase
            .from('spreadsheet_data')
            .delete()
            .eq('filename', 'Tiny ERP Auto-Import');

        if (error) {
            console.error('Error deleting Tiny orders:', error);
            return res.status(500).json({
                error: 'Failed to delete Tiny orders',
                details: error.message
            });
        }

        console.log(`✅ Successfully deleted Tiny orders`);

        return res.status(200).json({
            success: true,
            message: 'All Tiny ERP Auto-Import orders deleted',
            deleted_count: count || 'unknown',
            next_step: 'Run Sync Tiny button to reimport with correct SKU format'
        });

    } catch (error: any) {
        console.error('Delete Tiny orders error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
