
// Hardcode env vars for local execution since dotenv is missing
process.env.SUPABASE_URL = "https://geabvcqcymaqsqxxfqyw.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MTA5NywiZXhwIjoyMDg0NzU3MDk3fQ.WJxr9eSDzg7wfPAgBN6NgALfiUHc-DYeuFbEqG8N0hU";
process.env.TINY_API_TOKEN_MVF = "183258cff477d36d2b5d914730e8e3f7886e5d14";
process.env.TINY_API_TOKEN_MM = "01c03e39bc2559b2f21b9e97921379abcb9c8aad";

// Mock console to see output clearly or just let it log
async function run() {
    console.log('🚀 Manually triggering Retry Queue Processing (LOOP MODE)...');

    // Dynamic import to ensure env vars are set before module loads
    const { processRetryQueue } = await import('../api/process-retry-queue.js');

    let pending = true;
    let cycles = 0;
    const MAX_CYCLES = 50; // Safety limit

    while (pending && cycles < MAX_CYCLES) {
        cycles++;
        console.log(`\n🔄 Cycle ${cycles}/${MAX_CYCLES}...`);
        const result = await processRetryQueue();

        if (result.pendingCount === 0) {
            console.log('🎉 Queue is empty!');
            pending = false;
        } else {
            console.log(`📉 Pending: ${result.pendingCount}. Continuing...`);
            // Small delay to be nice to APIs
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.log('✅ Done.');
}

run().catch(console.error);
