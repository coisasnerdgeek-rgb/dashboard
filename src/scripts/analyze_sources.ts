import { createClient } from '@supabase/supabase-js';

// NEW DB Credentials
const NEW_SUPABASE_URL = 'https://geabvcqcymaqsqxxfqyw.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function analyzeSources() {
    console.log('--- Analyzing Data Sources in Spreadsheet Data ---');

    const { data: allRows, error } = await newSupabase
        .from('spreadsheet_data')
        .select('filename, row_data');

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    const stats: Record<string, { count: number, sampleKeys: string[] }> = {};

    allRows.forEach(row => {
        const file = row.filename || 'UNKNOWN_SOURCE';
        if (!stats[file]) {
            stats[file] = { count: 0, sampleKeys: [] };
        }
        stats[file].count++;
        // Keep first sample keys
        if (stats[file].sampleKeys.length === 0 && row.row_data) {
            stats[file].sampleKeys = Object.keys(row.row_data).slice(0, 5);
        }
    });

    console.log(JSON.stringify(
        Object.entries(stats).map(([filename, stat]) => ({
            Filename: filename,
            Count: stat.count,
            'Sample Keys': stat.sampleKeys
        })), null, 2
    ));
}

analyzeSources();
