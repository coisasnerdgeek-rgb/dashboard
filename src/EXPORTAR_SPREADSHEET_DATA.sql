-- ========================================================
-- EXPORTAR DADOS DE SPREADSHEET_DATA
-- Execute no SQL Editor do BANCO ANTIGO (nbxubdmsepnhhhsbpzoq)
-- ========================================================

-- PASSO 1: Ver a estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'spreadsheet_data'
ORDER BY ordinal_position;

-- PASSO 2: Ver quantos registros existem
SELECT COUNT(*) as total FROM public.spreadsheet_data;

-- PASSO 3: Ver alguns exemplos para entender a estrutura
SELECT * FROM public.spreadsheet_data LIMIT 3;
