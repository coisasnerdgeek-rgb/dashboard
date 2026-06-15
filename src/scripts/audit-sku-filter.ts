
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

async function checkSkuFilter() {
    console.log('Checking App.tsx ESTAMPAS filter logic on recent orders (31/01 - 01/02)...');

    // Fetch recent 500 rows to cover the date range
    const { data: recentData, error } = await supabase
        .from('spreadsheet_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    const keywords = ['peito', 'costa', 'costas', 'frente', 'manga', 'perso', 'personalizado', 'pi'];
    const blacklistStatus = ['enviado', 'entregue', 'cancelado', 'a caminho'];

    let passedCount = 0;
    let failedCount = 0;

    // Counters for failure reason
    let failReasons = {
        no_sku: 0,
        status_excluded: 0,
        no_keyword: 0,
        not_relevant_date: 0
    };

    const passedExamples: any[] = [];
    const processedDates = new Set();

    recentData.forEach(row => {
        const d = row.row_data;
        const sku = String(d['Código (SKU)'] || d['sku'] || d['Codigo (SKU)'] || d['SKU'] || '').toLowerCase();
        const status = String(d['Situação'] || d['status'] || '').toLowerCase();
        const date = String(d['Data'] || d['data'] || '');

        if (date) processedDates.add(date);

        // Focusing on the problematic dates
        if (!date.includes('31/01') && !date.includes('01/02')) {
            failReasons.not_relevant_date++;
            return;
        }

        if (!sku) {
            failReasons.no_sku++;
            return;
        }

        // 1. Status Filter
        if (blacklistStatus.some(s => status.includes(s))) {
            failReasons.status_excluded++;
            return;
        }

        // 2. Keyword Filter (App.tsx rule)
        const hasKeyword = keywords.some(k => sku.includes(k));

        if (hasKeyword) {
            passedCount++;
            if (passedExamples.length < 50) passedExamples.push({ sku, date, status });
        } else {
            failReasons.no_keyword++;
            failedCount++;
        }
    });

    console.log(`\nResults for 31/01 and 01/02:`);
    console.log(`Dates found in data dump:`, Array.from(processedDates).slice(0, 10));
    console.log(`✅ Should Appear (Passed Filters): ${passedCount}`);
    console.log(`❌ Hidden: ${failedCount}`);
    console.log('Failure Breakdown:', failReasons);
    console.log(`\nExamples of SHOULD APPEAR (Passed items):\n`, passedExamples);
}

checkSkuFilter();
