-- Migração: Adicionar campos faltantes na tabela print_control
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna nome_estampa (nome da estampa extraído do Google Drive)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS nome_estampa TEXT;

-- Adicionar coluna tratado (indica se as imagens foram processadas)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS tratado BOOLEAN DEFAULT FALSE;

-- Adicionar coluna cor (cor do produto)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS cor TEXT;

-- Adicionar coluna tamanho (tamanho do produto)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS tamanho TEXT;

-- Adicionar coluna data (data simplificada DD/MM)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS data TEXT;

-- Adicionar coluna l (campo L - uso específico do sistema)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS l TEXT;

-- Adicionar coluna aramado_letra (letra do aramado)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS aramado_letra TEXT;

-- Adicionar coluna aramado_numero (número do aramado)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS aramado_numero TEXT;

-- Adicionar coluna rastreio (código de rastreamento)
ALTER TABLE print_control 
ADD COLUMN IF NOT EXISTS rastreio TEXT;

-- Comentário explicativo
COMMENT ON COLUMN print_control.nome_estampa IS 'Nome da estampa extraído automaticamente da pasta do Google Drive';
COMMENT ON COLUMN print_control.tratado IS 'Indica se as imagens foram encontradas e processadas no Google Drive';
COMMENT ON COLUMN print_control.cor IS 'Cor do produto';
COMMENT ON COLUMN print_control.tamanho IS 'Tamanho do produto';
COMMENT ON COLUMN print_control.data IS 'Data simplificada no formato DD/MM';
COMMENT ON COLUMN print_control.l IS 'Campo L para controle interno';
COMMENT ON COLUMN print_control.aramado_letra IS 'Letra do aramado (A, B, C, etc)';
COMMENT ON COLUMN print_control.aramado_numero IS 'Número do aramado';
COMMENT ON COLUMN print_control.rastreio IS 'Código de rastreamento dos Correios';
