import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // No direct proxy, we handle it via middleware below
      }
    },
    plugins: [
      react(),
      {
        name: 'vercel-api-middleware',
        configureServer(server) {
          server.middlewares.use('/api', async (req, res, next) => {
            try {
              // Extract the specific endpoint
              const url = req.url?.split('?')[0] || '';
              let handler;

              // Map URLs to handler files
              if (url === '/sync-tiny' || url === '/sync-tiny/') {
                // @ts-ignore
                handler = (await import('./api/sync-tiny.ts')).default;
              } else if (url === '/process-retry-queue' || url === '/process-retry-queue/') {
                // @ts-ignore
                handler = (await import('./api/process-retry-queue.ts')).default;
              } else {
                next();
                return;
              }

              // Polyfill Vercel/Express methods
              const json = (data: any) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              };

              const status = (code: number) => {
                res.statusCode = code;
                return { json };
              };

              // Body parsing (Vite middleware doesn't parse body by default)
              if (req.method === 'POST') {
                const buffers: Buffer[] = [];
                req.on('data', (chunk) => buffers.push(chunk));
                req.on('end', async () => {
                  try {
                    const bodyStr = Buffer.concat(buffers).toString();
                    // Attach body to req
                    // @ts-ignore
                    req.body = bodyStr ? JSON.parse(bodyStr) : {};

                    // Enhance res object
                    // @ts-ignore
                    res.status = status;
                    // @ts-ignore
                    res.json = json;

                    await handler(req, res);
                  } catch (err) {
                    console.error('API Middleware Error:', err);
                    status(500).json({ error: 'Internal Server Error', details: String(err) });
                  }
                });
              } else {
                // GET request
                // @ts-ignore
                req.body = {};
                // @ts-ignore
                res.status = status;
                // @ts-ignore
                res.json = json;

                await handler(req, res);
              }

            } catch (error) {
              console.error('Middleware Loading Error:', error);
              next();
            }
          });
        }
      }
    ],
    define: {
      'process.env': JSON.stringify(process.env), // Expose all env vars
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(env.SUPABASE_SERVICE_ROLE_KEY),
      'process.env.TINY_API_TOKEN_MVF': JSON.stringify(env.TINY_API_TOKEN_MVF),
      'process.env.TINY_API_TOKEN_MM': JSON.stringify(env.TINY_API_TOKEN_MM),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || env.VITE_SUPABASE_URL),
      // Pass vital backend vars (ONLY SAFE ONES usually, but this is server config running in dev)
      // Actually, the import below will read process.env from Node process, so we need to populate it.
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

// Populate process.env with loaded env vars so imported modules can see them
const env = loadEnv('development', '.', '');
Object.assign(process.env, env);
