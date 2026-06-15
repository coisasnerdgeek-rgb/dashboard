
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function clearQueue() {
    console.log('🧹 Clearing webhook_retry_queue...');

    // Count first
    const { count, error: countError } = await supabase
        .from('webhook_retry_queue')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('❌ Error counting queue:', countError);
        return;
    }

    console.log(`📊 Found ${count} items in queue.`);

    if (count === 0) {
        console.log('✅ Queue is already empty.');
        return;
    }

    // Delete all
    const { error } = await supabase
        .from('webhook_retry_queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything

    if (error) {
        console.error('❌ Error deleting queue:', error);
    } else {
        console.log('✅ Queue cleared successfully!');
    }
}

clearQueue();
