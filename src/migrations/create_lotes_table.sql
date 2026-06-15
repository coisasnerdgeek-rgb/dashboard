-- Migration: Criar tabela 'lotes' para armazenar metadados dos lotes de estampas
-- Execute este SQL no Supabase SQL Editor
-- Data: 2026-01-13

-- =============================================
-- 1. CRIAR TABELA
-- =============================================

CREATE TABLE IF NOT EXISTS public.lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lote VARCHAR(20) NOT NULL UNIQUE,
  imagem_url TEXT NOT NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  thumbnail TEXT
);

-- =============================================
-- 2. COMENTÁRIOS EXPLICATIVOS
-- =============================================

COMMENT ON TABLE public.lotes IS 'Tabela para armazenar metadados dos lotes de estampas. As imagens são armazenadas no Google Drive.';
COMMENT ON COLUMN public.lotes.id IS 'Identificador único do lote (UUID gerado automaticamente)';
COMMENT ON COLUMN public.lotes.numero_lote IS 'Número/código do lote (até 20 caracteres, único)';
COMMENT ON COLUMN public.lotes.imagem_url IS 'URL pública da imagem do lote armazenada no Google Drive';
COMMENT ON COLUMN public.lotes.data_criacao IS 'Data e hora de criação do lote (timestamp com timezone)';
COMMENT ON COLUMN public.lotes.thumbnail IS 'URL da thumbnail da imagem (opcional)';

-- =============================================
-- 3. ÍNDICES PARA PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_lotes_numero_lote ON public.lotes(numero_lote);
CREATE INDEX IF NOT EXISTS idx_lotes_data_criacao ON public.lotes(data_criacao DESC);

-- =============================================
-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. POLÍTICAS RLS
-- =============================================

-- Política: Permitir SELECT para todos (público)
CREATE POLICY "Enable read access for all users"
ON public.lotes
FOR SELECT
USING (true);

-- Política: Permitir INSERT para todos (público)
CREATE POLICY "Enable insert access for all users"
ON public.lotes
FOR INSERT
WITH CHECK (true);

-- Política: Permitir UPDATE para todos (público)
CREATE POLICY "Enable update access for all users"
ON public.lotes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Política: Permitir DELETE para todos (público)
CREATE POLICY "Enable delete access for all users"
ON public.lotes
FOR DELETE
USING (true);

-- =============================================
-- 6. GRANT DE PERMISSÕES
-- =============================================

-- Garantir que o usuário anônimo (anon) pode acessar a tabela
GRANT ALL ON public.lotes TO anon;
GRANT ALL ON public.lotes TO authenticated;

-- =============================================
-- 7. VERIFICAÇÃO
-- =============================================

-- Mostrar estrutura da tabela
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'lotes'
ORDER BY ordinal_position;

-- Mostrar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'lotes';

-- =============================================
-- 8. ÍNDICE NA COLUNA L DA TABELA print_control
-- =============================================

-- Adicionar índice na coluna 'l' para melhorar performance nas consultas de lote
CREATE INDEX IF NOT EXISTS idx_print_control_lote ON public.print_control(l);

COMMENT ON INDEX idx_print_control_lote IS 'Índice para melhorar performance ao filtrar pedidos por lote';

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela "lotes" criada com sucesso!';
  RAISE NOTICE '✅ Políticas RLS configuradas.';
  RAISE NOTICE '✅ Índices criados para performance.';
  RAISE NOTICE '✅ Permissões concedidas.';
  RAISE NOTICE '✅ Índice criado na coluna L de print_control.';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Próximos passos:';
  RAISE NOTICE '   1. Testar upload de lote na aplicação';
  RAISE NOTICE '   2. Verificar se o erro PGRST205 foi resolvido';
END $$;

