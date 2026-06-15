
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim();
});

const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMissingOrders() {
    console.log('Checking for orders from 31/01 to 01/02...');

    // 1. Check spreadsheet_data
    // Note: row_data is JSON, so we need to filter inside or fetch more and filter in JS
    // We'll search for '31/01/2026' ? wait, current year is 2026? Yes.
    // Or just fetch recent ones.

    const { data: recentData, error } = await supabase
        .from('spreadsheet_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching spreadsheet_data:', error);
        return;
    }

    const missingDates = ['31/01/2026', '01/02/2026', '31/01/2025', '01/02/2025']; // Just in case year is 2025

    console.log(`Scanning last 100 rows for dates: ${missingDates.join(', ')}`);

    let foundCount = 0;
    recentData.forEach(row => {
        const d = row.row_data;
        const date = d['Data'] || d['data'] || d['Data Venda'];
        if (date && missingDates.some(md => date.includes(md.slice(0, 5)))) { // Match DD/MM
            console.log(`[spreadsheet_data] FOUND: ID ${d['ID Tiny'] || d['id']} - Date: ${date} - Status: ${d['Situacao'] || d['status']}`);
            foundCount++;
        }
    });

    if (foundCount === 0) {
        console.log('No orders found in spreadsheet_data for these dates.');
    } else {
        console.log(`Found ${foundCount} orders in spreadsheet_data.`);
    }


    // 2. Check webhook_retry_queue summary
    console.log('\nChecking webhook_retry_queue summary...');

    // Group by status
    const { data: statusCounts, error: errorCounts } = await supabase
        .from('webhook_retry_queue')
        .select('status, order_date')
        .gt('created_at', new Date(Date.now() - 1000 * 60 * 10).toISOString()); // Last 10 mins

    if (errorCounts) {
        console.error('Error fetching queue counts:', errorCounts);
    } else {
        const counts: Record<string, number> = {};
        const dateCounts: Record<string, number> = {};

        statusCounts.forEach(r => {
            counts[r.status] = (counts[r.status] || 0) + 1;
            const d = r.order_date || 'unknown';
            dateCounts[d] = (dateCounts[d] || 0) + 1;
        });

        console.log('Queue Status (Last 10 mins):', counts);
        console.log('Orders by Date (Last 10 mins):', dateCounts);
    }
}

checkMissingOrders();
