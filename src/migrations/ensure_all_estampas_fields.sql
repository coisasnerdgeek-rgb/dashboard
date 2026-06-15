-- =========================================
-- Migration: Ensure all Estampas fields exist in print_control
-- Execute this in Supabase SQL Editor
-- =========================================

-- Campo 'link' para armazenar link geral
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS link TEXT;

-- Campo 'link_pedido' para URL personalizada
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS link_pedido TEXT;

-- Campo 'local_estampa' (PEITO, COSTAS, etc)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS local_estampa TEXT;

-- Campo 'observacao' para notas
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Campo 'data_prevista' (data prevista de entrega)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS data_prevista TEXT;

-- Campo 'google_drive_folder_id' (ID da pasta do Google Drive)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- Campo 'google_drive_images' (JSON com imagens do Drive)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS google_drive_images TEXT;

-- Campo 'arte_pronta_id' (ID da arte pronta)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS arte_pronta_id TEXT;

-- Campos já adicionados em migrações anteriores (garantir que existem)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS nome_estampa TEXT;

ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS tratado BOOLEAN DEFAULT FALSE;

ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS cor TEXT;

ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS tamanho TEXT;

ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS data TEXT;

ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS l TEXT;

ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS aramado_letra TEXT;

ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS aramado_numero TEXT;

ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS rastreio TEXT;

-- Comentários explicativos
COMMENT ON COLUMN print_control.link IS 'Link geral do pedido';
COMMENT ON COLUMN print_control.link_pedido IS 'URL personalizada do pedido (para canais SH MM e SH VEST)';
COMMENT ON COLUMN print_control.local_estampa IS 'Localização da estampa (PEITO, COSTAS, PEITO E COSTAS)';
COMMENT ON COLUMN print_control.observacao IS 'Observações sobre o pedido';
COMMENT ON COLUMN print_control.data_prevista IS 'Data prevista de entrega (DD/MM)';
COMMENT ON COLUMN print_control.google_drive_folder_id IS 'ID da pasta do Google Drive contendo imagens';
COMMENT ON COLUMN print_control.google_drive_images IS 'JSON com URLs das imagens do Google Drive';
COMMENT ON COLUMN print_control.arte_pronta_id IS 'ID da arte pronta associada';

-- Verificação final
DO $$
BEGIN
  RAISE NOTICE '✅ Migração completa! Todos os campos de Estampas foram adicionados à tabela print_control.';
END $$;
