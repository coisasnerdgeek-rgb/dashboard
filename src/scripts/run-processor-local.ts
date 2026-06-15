/**
 * PROCESSADOR DE FILA LOCAL (COM LOOP AUTOMÁTICO)
 * 
 * Executa a mesma lógica do backend mas localmente, sem timeout da Vercel.
 * Processa do mais recente para o mais antigo.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = value;
        }
    });
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TINY_TOKEN_MM = process.env.TINY_API_TOKEN_MM || process.env.TINY_API_TOKEN;
const TINY_TOKEN_MVF = process.env.TINY_API_TOKEN_MVF;

// Helper to convert DD/MM/YYYY to Date
function convertToDateFromString(dateStr: string): Date {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(0);
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
}

// --- Lógica de Negócio (Copiada do backend) ---

function getEcommerceStore(orderId: string | number, fileCnpj: 'MM' | 'MVF' | string | null): string {
    const id = String(orderId ?? '').trim();
    if (!id) return 'BUSINESS';

    const isShopee = ['26', '2510', 'ID2', '25091', '25010', '25011', '2509', '2501', '2502', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260'].some(prefix => id.startsWith(prefix));
    if (isShopee) {
        if (fileCnpj === 'MM' || fileCnpj?.includes('39447291')) return 'SH MM';
        return 'SH VEST';
    }

    let lojaBase: string;
    if (id.startsWith('2000') || id.startsWith('2,000') || id.startsWith('0200') || id.startsWith('MLB')) {
        lojaBase = 'ML VEST';
    } else if (id.startsWith('LU-')) {
        lojaBase = 'MG VEST';
    } else if (id.startsWith('14')) {
        lojaBase = 'NT VEST';
    } else if (id.startsWith('GSH')) {
        lojaBase = 'SN VEST';
    } else if (id.match(/^\d{3}-\d{7}-\d{7}$/) || id.startsWith('701') || id.startsWith('702')) {
        lojaBase = 'AM VEST';
    } else if (id.startsWith('12')) {
        lojaBase = 'KW VEST';
    } else {
        lojaBase = 'BUSINESS';
    }

    if ((fileCnpj === 'MM' || fileCnpj?.includes('39447291')) && lojaBase !== 'BUSINESS') {
        return lojaBase.replace('VEST', 'MM');
    }

    return lojaBase;
}

function getSupplier(salesChannel: string, fileCnpj?: string | null): string {
    const upper = salesChannel.trim().toUpperCase();
    if (upper.endsWith(' MM') || upper.includes(' MM')) return 'MM';
    if (upper.endsWith(' VEST') || upper.includes(' VEST')) return 'MVF';
    if (fileCnpj === 'MM') return 'MM';
    if (fileCnpj === 'MVF') return 'MVF';
    return 'MVF'; // Default
}

// --- Main Processor ---

async function fetchTinyOrder(orderId: string, token: string) {
    try {
        const url = `https://api.tiny.com.br/api2/pedido.obter.php?token=${token}&id=${orderId}&formato=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.retorno?.status === 'Erro') {
            const erro = data.retorno.codigo_erro;
            // 6 = Too many requests, 31 = Pedido não localizado (erro comum se usar token errado)
            if (erro == 6) return { error: 'rate_limit' };
            if (erro == 31) return { error: 'not_found' };
            return { error: data.retorno.erros[0]?.erro || 'Unknown error' };
        }

        return { data: data.retorno?.pedido };
    } catch (e: any) {
        return { error: e.message };
    }
}

async function runProcessor() {
    console.log('\n🚀 INICIANDO PROCESSADOR DE FILA LOCAL\n');
    console.log('='.repeat(60) + '\n');

    if (!SUPABASE_KEY) {
        console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada!');
        process.exit(1);
    }
    console.log('✅ Chave Service Role carregada com sucesso.');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let totalProcessed = 0;

    while (true) {
        // 1. Buscar pendentes (mesma ordenação do backend: mais recentes primeiro)
        const { data: pending, error } = await supabase
            .from('webhook_retry_queue')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false }) // Buscar mais novos primeiro
            .limit(20);

        if (error) {
            console.error('❌ Erro ao buscar fila:', error.message);
            break;
        }

        if (!pending || pending.length === 0) {
            console.log('\n✅ Fila vazia! Todos os pedidos foram processados.\n');
            break;
        }

        // Ordenar em memória por order_date (mais confiável)
        const batch = pending.sort((a, b) => {
            const dateA = a.order_date ? convertToDateFromString(a.order_date) : new Date(0);
            const dateB = b.order_date ? convertToDateFromString(b.order_date) : new Date(0);
            return dateB.getTime() - dateA.getTime();
        });

        console.log(`📦 Processando lote de ${batch.length} pedidos...`);

        for (const item of batch) {
            process.stdout.write(`   ▶️  Pedido ${item.order_id}... `);

            // Tentar MVF primeiro (padrão)
            let result = await fetchTinyOrder(item.order_id, TINY_TOKEN_MVF!);
            let usedCompany = 'MVF';

            // Se não achar, tentar MM
            if (result.error === 'not_found' && TINY_TOKEN_MM) {
                result = await fetchTinyOrder(item.order_id, TINY_TOKEN_MM);
                usedCompany = 'MM';
            }

            if (result.error) {
                if (result.error === 'rate_limit') {
                    console.log('⏳ Rate Limit. Aguardando 5s...');
                    await new Promise(r => setTimeout(r, 5000));
                    // Re-enfileirar mesmo item para tentar de novo
                    continue;
                }

                console.log(`❌ Erro: ${result.error}`);

                await supabase.from('webhook_retry_queue')
                    .update({
                        status: 'failed',
                        last_error: result.error
                    })
                    .eq('id', item.id);

                continue;
            }

            const pedido = result.data;

            // Extrair dados corretos
            const ecommerceId = pedido.numero_ecommerce || '';
            const clienteNome = pedido.cliente?.nome || 'Cliente Desconhecido';
            const cnpjDestino = usedCompany; // 'MM' ou 'MVF'

            // Calcular loja correta
            const loja = getEcommerceStore(ecommerceId, cnpjDestino);
            const fornecedor = getSupplier(loja, cnpjDestino);

            // Atualizar spreadsheet_data
            const rowData = {
                "Data": pedido.data_pedido,
                "Numero": pedido.numero_pedido,
                "Cliente": clienteNome,
                "Valor": pedido.valor_pedido,
                "Situacao": pedido.situacao,
                "Loja": loja,
                "ID Tiny": pedido.id,
                "Ecommerce ID": ecommerceId,
                "Canal": loja, // Importante para compatibilidade
                // Outros campos padrão que puder preencher
                "Mapeamento": "Automático via Script"
            };

            const insertResult = await supabase.from('spreadsheet_data').insert({
                filename: 'Tiny ERP Auto-Import',
                row_data: rowData,
                status: 'pending',
                import_date: new Date().toISOString()
            });

            if (insertResult.error) {
                console.error(`❌ Erro insert spreadsheet: ${insertResult.error.message}`);
            }

            // Marcar fila como completada com SELECT para confirmar
            const updateResult = await supabase.from('webhook_retry_queue')
                .update({
                    status: 'completed',
                    last_error: null
                })
                .eq('id', item.id)
                .select();

            if (updateResult.error) {
                console.error(`❌ Erro update queue: ${updateResult.error.message}`);
            } else if (updateResult.data.length === 0) {
                console.error(`❌ Update queue retornou 0 linhas alteradas! (ID: ${item.id}) - Verifique RLS ou ID`);
            } else {
                console.log(`✅ OK (${loja})`);
                totalProcessed++;
            }

            // Evitar rate limit (1 req por segundo é seguro)
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    console.log('\nResultados Finais:');
    console.log(`✅ Total processados: ${totalProcessed}`);
}

runProcessor().catch(console.error);
