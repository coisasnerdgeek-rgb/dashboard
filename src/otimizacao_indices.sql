-- ============================================================================
-- SCRIPT DE OTIMIZAÇÃO DE BANCO DE DADOS (SUPABASE)
-- Execute estas queries diretamente no SQL Editor do seu painel do Supabase.
-- ============================================================================

-- 1. Otimização de busca temporal de planilhas importadas (Acelera getSpreadsheetData)
-- Evita o escaneamento sequencial e ordenação manual de todas as linhas.
CREATE INDEX IF NOT EXISTS idx_spreadsheet_data_import_date 
ON public.spreadsheet_data (import_date DESC);


-- 2. Otimização de ordenação da tela de estampas (Acelera getEstampasStatus)
-- Evita a ordenação em disco/memória por data de atualização.
CREATE INDEX IF NOT EXISTS idx_print_control_updated_at 
ON public.print_control (updated_at DESC);


-- 3. Otimização do cálculo de métricas de pedidos ativos (Acelera getDashboardMetrics)
-- Índice parcial que armazena apenas dados não arquivados, economizando memória e sendo instantâneo.
CREATE INDEX IF NOT EXISTS idx_saved_orders_active_partial 
ON public.saved_orders (id) 
WHERE archived_date IS NULL;


-- 4. Substituição de índices GIN lentos por índices B-Tree específicos em chaves JSONB (Acelera importações)
-- Índices B-Tree na extração direta de texto (->>) são mais eficientes do que índices GIN estruturais para buscas de igualdade de SKU e ID.

-- Para o campo SKU:
DROP INDEX IF EXISTS public.idx_spreadsheet_data_sku;
CREATE INDEX IF NOT EXISTS idx_spreadsheet_data_sku_btree 
ON public.spreadsheet_data ((row_data->>'SKU'));

-- Para o campo ID Tiny:
DROP INDEX IF EXISTS public.idx_spreadsheet_data_tiny_id;
CREATE INDEX IF NOT EXISTS idx_spreadsheet_data_tiny_id_btree 
ON public.spreadsheet_data ((row_data->>'ID Tiny'));
