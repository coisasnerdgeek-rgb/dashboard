
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Load Environment Variables manually
function loadEnv(filename) {
    try {
        console.log(`Current CWD: ${process.cwd()}`);
        console.log(`Checking for ${filename}...`);
        const envPath = path.resolve(process.cwd(), filename);

        if (fs.existsSync(envPath)) {
            console.log(`Loading ${filename}...`);
            let envConfig = fs.readFileSync(envPath, 'utf8');

            // Remove BOM if present
            if (envConfig.charCodeAt(0) === 0xFEFF) {
                envConfig = envConfig.slice(1);
            }

            envConfig.split(/\r?\n/).forEach((line) => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;

                const equalsIndex = line.indexOf('=');
                if (equalsIndex === -1) return;

                const key = line.substring(0, equalsIndex).trim();
                let value = line.substring(equalsIndex + 1).trim();

                // Remove surrounding quotes
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                if (key) {
                    process.env[key] = value;
                    // Mask value in log
                    const masked = value ? (value.substring(0, 4) + '...') : 'empty';
                    console.log(`  Loaded ${key}: ${masked}`);
                }
            });
        } else {
            console.log(`${filename} not found.`);
        }
    } catch (e) {
        console.error(`Error loading ${filename}`, e);
    }
}

// Load .env then .env.local (local overrides)
loadEnv('.env');
loadEnv('.env.local');

// 2. Mock Request/Response
const req = {
    method: 'POST',
    body: {
        daysBack: 60,
        maxOrders: 100000,
        forceReprocess: true
    }
};

const res = {
    setHeader: () => { },
    status: (code) => {
        console.log(`Response Status: ${code}`);
        return res;
    },
    json: (data) => {
        // Truncate huge output
        const str = JSON.stringify(data, null, 2);
        if (str.length > 5000) console.log('Response Data:', str.substring(0, 1000) + '... (truncated)');
        else console.log('Response Data:', str);

        return res;
    },
    end: () => { }
};

// 3. Import and Run Handler
async function run() {
    try {
        console.log('Importing sync handler...');
        // Dynamic import after env vars are set
        const handlerModule = await import('../api/sync-tiny.ts');
        const handler = handlerModule.default;

        console.log('Running Full Sync (30 days, force reprocess)...');
        // @ts-ignore
        await handler(req, res);
        console.log('Done.');
    } catch (e) {
        console.error('Execution Error:', e);
    }
}

run();
