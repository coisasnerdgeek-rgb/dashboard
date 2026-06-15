-- ========================================================
-- SCRIPT DE AJUSTE: BIBLIOTECA DE IMAGENS (UUID -> TEXT)
-- Execute este script no SQL Editor do seu NOVO projeto Supabase.
-- Isso permitirá importar IDs de categoria em formato de texto (ex: cat-123).
-- ========================================================

-- 1. Descobrir o nome da constraint de chave estrangeira (normalmente image_mappings_category_id_fkey)
-- e removê-la temporariamente para permitir a alteração de tipos.
DO $$ 
DECLARE
    const_name TEXT;
BEGIN
    SELECT constraint_name INTO const_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'image_mappings' AND column_name = 'category_id'
    AND table_schema = 'public';

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.image_mappings DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- 2. Alterar o tipo da coluna id na tabela image_categories
ALTER TABLE public.image_categories 
ALTER COLUMN id TYPE TEXT;

-- 3. Alterar o tipo da coluna category_id na tabela image_mappings
ALTER TABLE public.image_mappings 
ALTER COLUMN category_id TYPE TEXT;

-- 4. Re-adicionar a chave estrangeira
ALTER TABLE public.image_mappings
ADD CONSTRAINT image_mappings_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.image_categories(id) ON DELETE SET NULL;

-- 5. Atualizar o cache do PostgREST
NOTIFY pgrst, 'reload schema';
