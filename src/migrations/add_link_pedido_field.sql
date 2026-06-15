-- Migração: Adicionar campo link_pedido para URLs personalizadas de pedidos
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna link_pedido (URL personalizada do pedido)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS link_pedido TEXT;

-- Comentário explicativo
COMMENT ON COLUMN print_control.link_pedido IS 'URL personalizada do pedido (para canais SH MM e SH VEST)';
