-- ========================================================
-- SCRIPT DE DESBLOQUEIO: IMPORTAÇÃO DE IMAGENS
-- Execute este script no SQL Editor do seu NOVO projeto Supabase.
-- Isso desativa a trava que exige a categoria antes da imagem.
-- ========================================================

-- 1. Remover a restrição de chave estrangeira
-- Isso permite importar as imagens mesmo que a categoria ainda não tenha sido importada.
ALTER TABLE public.image_mappings 
DROP CONSTRAINT IF EXISTS image_mappings_category_id_fkey;

-- 2. Garantir que as colunas aceitem qualquer texto (reforço)
ALTER TABLE public.image_categories ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.image_mappings ALTER COLUMN category_id TYPE TEXT;

-- 3. Notificar o sistema
NOTIFY pgrst, 'reload schema';

-- 💡 DICA: Após rodar este script, você pode importar seus arquivos CSV 
-- em qualquer ordem pelo dashboard do Supabase (Aba Imagem ou Tabela).
