import { createClient } from '@supabase/supabase-js';



const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Disable automatic body parsing to handle raw body
// export const config = {
//     api: {
//         bodyParser: false,
//     },
// };

// async function getRawBody(req: any): Promise<string> {
//     return new Promise((resolve, reject) => {
//         let data = '';
//         req.on('data', (chunk: any) => { data += chunk; });
//         req.on('end', () => { resolve(data); });
//         req.on('error', reject);
//     });
// }

export default async function handler(req: any, res: any) {
    // ALWAYS return 200 OK to Tiny ERP as fast as possible
    try {
        const timestamp = new Date().toISOString();
        console.log(`🔔 Webhook received at: ${timestamp}`);

        // 0. Handle CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        // 1. Health Check (GET)
        if (req.method === 'GET') {
            return res.status(200).json({
                status: 'online',
                message: 'Tiny Webhook Listener is active and in ASYNC mode.',
            });
        }

        if (req.method !== 'POST') {
            return res.status(200).json({ success: false, error: 'Only POST allowed' });
        }

        // 2. Extract Payload from req.body (handled by Vercel)
        let body = req.body;
        console.log('--- WEBHOOK DEBUG ---');
        console.log('Headers:', JSON.stringify(req.headers));

        // 3. Robust Payload Parsing
        let payload: any;

        if (typeof body === 'object' && body !== null) {
            // Already parsed by bodyParser
            if (body.dados) {
                if (typeof body.dados === 'object') {
                    payload = body.dados;
                } else {
                    try {
                        payload = JSON.parse(body.dados);
                    } catch (e) {
                        console.error("Failed to parse body.dados as JSON string", e);
                        payload = body;
                    }
                }
            } else {
                payload = body;
            }
        } else if (typeof body === 'string' && body.length > 0) {
            // String body (could happen if bodyParser failed or specific content-type)
            try {
                if (body.startsWith('{')) {
                    const parsedBody = JSON.parse(body);
                    if (parsedBody.dados) {
                        if (typeof parsedBody.dados === 'object') {
                            payload = parsedBody.dados;
                        } else {
                            payload = JSON.parse(parsedBody.dados);
                        }
                    } else {
                        payload = parsedBody;
                    }
                } else {
                    const params = new URLSearchParams(body);
                    const dados = params.get('dados');
                    if (dados) {
                        try {
                            payload = JSON.parse(dados);
                        } catch (e) {
                            console.error("Failed to parse 'dados' parameter as JSON", e);
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to parse string body", e);
            }
        }

        if (!payload || Object.keys(payload).length === 0) {
            console.log('⚠️ No payload identified - might be a ping or unrecognized format');
            return res.status(200).json({ status: 'OK', message: 'No payload' });
        }

        // 4. Identify Order and Company
        // Robust extraction from both body and payload
        let orderId = body.id || body.idPedido || payload.id || payload.idPedido || (payload.dados?.id) || (body.dados?.id);
        const cnpj = body.cnpj || body.dados?.cnpj || payload.cnpj || payload.dados?.cnpj || '';

        const companyIdentifier = (cnpj === '25116514000138' || cnpj.includes('25116514')) ? 'MVF' : 'MM';

        console.log(`📦 Identified Order: ${orderId} | Company: ${companyIdentifier} | CNPJ: ${cnpj}`);
        console.log('Payload:', JSON.stringify(payload));

        // 5. Save to Queue (Supabase)
        if (SUPABASE_URL && SUPABASE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

            // Deduplication: Avoid queuing the exact same payload within a short timeframe if possible,
            // but for safety, we just insert. The processor will handle deduplication of actual orders.
            const { error: queueError } = await supabase
                .from('webhook_retry_queue')
                .insert({
                    order_id: String(orderId || 'unknown'),
                    cnpj: cnpj,
                    company: companyIdentifier,
                    payload: payload,
                    status: 'pending',
                    next_retry_at: new Date().toISOString() // Ready for immediate processing
                });

            if (queueError) {
                console.error('❌ Error saving to queue:', queueError);
            } else {
                console.log(`✅ Order ${orderId} saved to queue for background processing.`);
            }
        }

        // 6. Final Response - Always 200 OK
        return res.status(200).json({
            status: 'OK',
            message: 'Webhook received and queued',
            orderId
        });

    } catch (err: any) {
        console.error("🚨 Critical Error in Webhook Handler:", err.message);
        // Safety net: always return 200
        return res.status(200).json({ status: 'OK', error: 'Internal failure but link kept alive' });
    }
}
