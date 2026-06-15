-- Execute este SQL no painel do Supabase (SQL Editor)
-- Isso vai criar índices para acelerar as queries de duplicatas

-- Índice para ID Tiny (usado na verificação de duplicatas)
CREATE INDEX IF NOT EXISTS idx_spreadsheet_data_tiny_id 
ON spreadsheet_data USING GIN ((row_data->'ID Tiny'));

-- Índice para SKU (usado na verificação de duplicatas)
CREATE INDEX IF NOT EXISTS idx_spreadsheet_data_sku 
ON spreadsheet_data USING GIN ((row_data->'SKU'));

-- Índice para Número do pedido (usado em buscas gerais)
CREATE INDEX IF NOT EXISTS idx_spreadsheet_data_numero_pedido 
ON spreadsheet_data USING GIN ((row_data->'Número do pedido'));
