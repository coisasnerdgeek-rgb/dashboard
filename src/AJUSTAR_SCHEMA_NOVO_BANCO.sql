-- ========================================================
-- AJUSTE DO SCHEMA DO NOVO BANCO PARA FICAR IGUAL AO ORIGINAL
-- Execute ANTES de importar os dados
-- ========================================================

-- 1. Adicionar coluna "status" na tabela verification_status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'verification_status' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.verification_status 
        ADD COLUMN status text;
        
        COMMENT ON COLUMN public.verification_status.status IS 'Added to match original schema';
    END IF;
END $$;

-- 2. Adicionar coluna "id" na tabela app_settings (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'app_settings' 
        AND column_name = 'id'
    ) THEN
        ALTER TABLE public.app_settings 
        ADD COLUMN id bigserial;
        
        COMMENT ON COLUMN public.app_settings.id IS 'Added to match original schema';
    END IF;
END $$;

-- 3. Verificar e adicionar coluna "data_criacao" na tabela lotes (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'lotes' 
        AND column_name = 'data_criacao'
    ) THEN
        ALTER TABLE public.lotes 
        ADD COLUMN data_criacao timestamp with time zone DEFAULT now();
        
        COMMENT ON COLUMN public.lotes.data_criacao IS 'Added to match original schema';
    END IF;
END $$;

-- 4. Adicionar colunas de data na tabela verification_status
DO $$ 
BEGIN
    -- created_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'verification_status' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.verification_status 
        ADD COLUMN created_at timestamp with time zone DEFAULT now();
    END IF;
    
    -- updated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'verification_status' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.verification_status 
        ADD COLUMN updated_at timestamp with time zone DEFAULT now();
    END IF;
END $$;

-- 5. Exibir relatório das mudanças
SELECT 
    'verification_status' as tabela,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'verification_status'
ORDER BY ordinal_position;

-- Mensagem de sucesso
DO $$ 
BEGIN
    RAISE NOTICE '✅ Schema ajustado com sucesso! Agora as tabelas estão compatíveis com o banco original.';
END $$;
