const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let previousPending = null;
let previousCompleted = null;
let previousFailed = null;

async function monitor() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get queue stats
    const { data: queue } = await supabase
        .from('webhook_retry_queue')
        .select('status');

    const stats = {
        pending: 0,
        completed: 0,
        failed: 0,
        error: 0
    };

    queue?.forEach(q => {
        const status = q.status || 'unknown';
        stats[status] = (stats[status] || 0) + 1;
    });

    // Get spreadsheet count
    const { count: spreadsheetCount } = await supabase
        .from('spreadsheet_data')
        .select('*', { count: 'exact', head: true });

    // Calculate changes
    const pendingDelta = previousPending !== null ? stats.pending - previousPending : 0;
    const completedDelta = previousCompleted !== null ? stats.completed - previousCompleted : 0;
    const failedDelta = previousFailed !== null ? (stats.failed + stats.error) - previousFailed : 0;

    // Display
    console.clear();
    console.log('🔄 MONITOR DE IMPORTAÇÃO - Atualizado:', new Date().toLocaleTimeString());
    console.log('='.repeat(60));
    console.log('');
    console.log(`📋 FILA:`);
    console.log(`   Pendentes:   ${stats.pending.toString().padStart(6)} ${pendingDelta !== 0 ? `(${pendingDelta > 0 ? '+' : ''}${pendingDelta})` : ''}`);
    console.log(`   Completados: ${stats.completed.toString().padStart(6)} ${completedDelta !== 0 ? `(${completedDelta > 0 ? '+' : ''}${completedDelta})` : ''}`);
    console.log(`   Falhados:    ${(stats.failed + stats.error).toString().padStart(6)} ${failedDelta !== 0 ? `(${failedDelta > 0 ? '+' : ''}${failedDelta})` : ''}`);
    console.log('');
    console.log(`📊 SPREADSHEET_DATA:`);
    console.log(`   Total:       ${spreadsheetCount?.toString().padStart(6)}`);
    console.log('');

    // Progress
    const total = stats.pending + stats.completed + stats.failed + stats.error;
    const processed = stats.completed + stats.failed + stats.error;
    const progress = total > 0 ? ((processed / total) * 100).toFixed(1) : 0;

    console.log(`📈 PROGRESSO: ${progress}% (${processed} / ${total})`);

    // ETA
    if (completedDelta > 0 && stats.pending > 0) {
        const ordersPerSecond = completedDelta / 10; // 10 second intervals
        const secondsRemaining = stats.pending / ordersPerSecond;
        const minutes = Math.floor(secondsRemaining / 60);
        const seconds = Math.floor(secondsRemaining % 60);
        console.log(`⏱️  ETA: ~${minutes}m ${seconds}s`);
    }

    console.log('');
    console.log('Pressione CTRL+C para parar o monitor');
    console.log('='.repeat(60));

    // Update previous values
    previousPending = stats.pending;
    previousCompleted = stats.completed;
    previousFailed = stats.failed + stats.error;
}

// Run every 10 seconds
console.log('🚀 Iniciando monitor...\n');
monitor();
setInterval(monitor, 10000);
