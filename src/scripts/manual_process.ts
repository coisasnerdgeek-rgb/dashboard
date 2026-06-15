
import fs from 'fs';
import path from 'path';

// 1. Load Environment Variables
function loadEnv(filename) {
    try {
        const envPath = path.resolve(process.cwd(), filename);
        if (fs.existsSync(envPath)) {
            console.log(`Loading ${filename}...`);
            const envConfig = fs.readFileSync(envPath, 'utf8');
            envConfig.split(/\r?\n/).forEach((line) => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const equalsIndex = line.indexOf('=');
                if (equalsIndex === -1) return;
                const key = line.substring(0, equalsIndex).trim();
                let value = line.substring(equalsIndex + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                if (key) process.env[key] = value;
            });
        }
    } catch (e) {
        console.error(`Error loading ${filename}`, e);
    }
}

loadEnv('.env.local');

// 2. Mock Request/Response
const req = {};
let lastResult: any = null;
const res = {
    setHeader: () => { },
    status: (code) => { return res; },
    json: (data) => {
        lastResult = data;
        return res;
    },
    end: () => { }
};

// 3. Import and Run Handler
async function run() {
    try {
        console.log('Importing process-retry-queue handler...');
        const handlerModule = await import('../api/process-retry-queue.ts');
        const handler = handlerModule.default;

        console.log('Running Queue Processor Locally in Loop...');
        let hasMore = true;
        let totalProcessed = 0;
        let batchCount = 0;

        while (hasMore) {
            batchCount++;
            lastResult = null;
            console.log(`\n--- Processing Batch #${batchCount} (Total so far: ${totalProcessed}) ---`);

            // @ts-ignore
            await handler(req, res);

            const result = lastResult;
            if (result && result.success) {
                const completed = (result.completed || 0);
                const retried = (result.retried || 0);
                const failed = (result.failed || 0);
                totalProcessed += completed;
                const pending = result.pendingCount || 0;

                console.log(`Summary: Completed: ${completed}, Retried: ${retried}, Failed: ${failed}. Pending: ${pending}`);

                if (pending === 0 || (completed === 0 && retried === 0)) {
                    hasMore = false;
                }
            } else {
                console.log('Error or no result:', result);
                hasMore = false;
            }

            // Safety break: Removed to process everything
            if (batchCount > 1000) break;
        }

        console.log(`\n✅ Finished! Total Processed: ${totalProcessed} in ${batchCount} batches.`);

    } catch (e) {
        console.error('Execution Error:', e);
    }
}

run();
