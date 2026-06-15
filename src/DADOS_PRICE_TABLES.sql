-- ========================================================
-- SCRIPT DE DADOS: price_tables
-- Copie e cole no SQL Editor do NOVO projeto.
-- ========================================================

-- Limpar dados existentes para evitar conflitos (opcional)
-- DELETE FROM public.price_tables;

INSERT INTO public.price_tables (id, category, product, sku_product_name, prices_json)
VALUES
('p28', 'Masculino', 'CAMISETA POLIESTER', NULL, '{"SITE":{"BRANCO":11.2},"GUSHI":{"COR":15.2,"BRANCO":25.2,"ESPECIAL":15.2},"MAGIC":{"COR":15,"BRANCO":14},"INDICE":{"COR":21,"BRANCO":21}}'),
('p4', 'Feminino', 'BLUSA GOLA CARECA PLUS SIZE FENOMENAL', NULL, '{"FENOMENAL":{"COR":37,"BRANCO":37}}'),
('p22', 'Masculino', 'CAMISETA MASCULINA PLUS', 'Camiseta Masculina Plus', '{"SITE":{"BRANCO":21},"GUSHI":{"COR":28.9,"BRANCO":28.9,"ESPECIAL":28.9},"MAGIC":{"COR":21,"BRANCO":21},"FENOMENAL":{"COR":28,"BRANCO":28}}'),
('p25', 'Masculino', 'CAMISETA MASCULINA V MALHA FRIA', 'Camiseta Masculina V Malha Fria', '{"SITE":{"BRANCO":12.4},"GUSHI":{"COR":20,"BRANCO":17.8,"ESPECIAL":21.5},"INDICE":{"COR":21,"BRANCO":21}}'),
('p8', 'Feminino', 'BLUSA V LONGA BÁSICA', NULL, '{"INDICE":{"COR":21,"BRANCO":21}}'),
('p32', 'Outros', 'CAPA DE CHUVA TRANSPARENTE', 'Capa de Chuva Transparente', '{"SITE":{"BRANCO":3.5}}'),
('p1', 'Outros', 'QUADRO A4 UV', NULL, '{"SITE":{"BRANCO":15.5},"MAGIC":{"COR":15,"BRANCO":14}}'),
('p10', 'Outros', 'CALÇA DE MOLETOM', NULL, '{"MAGIC":{"COR":45,"BRANCO":45}}'),
('p11', 'Outros', 'CALÇA DE MOLETOM XG', NULL, '{"MAGIC":{"COR":49,"BRANCO":49}}'),
('p12', 'Feminino', 'CAMISETA BABYLOOK PLUS SIZE FENOMENAL', 'Babylook', '{"SITE":{"BRANCO":21},"GUSHI":{"COR":28.9,"BRANCO":28.9,"ESPECIAL":28.9},"MAGIC":{"COR":21,"BRANCO":21},"FENOMENAL":{"COR":28,"BRANCO":28}}'),
('p13', 'Masculino', 'CAMISETA GOLA V MALHA FRIA PLUS SIZE MASCULINA', NULL, '{"SITE":{"BRANCO":30},"FENOMENAL":{"COR":34,"BRANCO":34}}'),
('p14', 'Feminino', 'CAMISETA GOLA V PLUS SIZE FEMININA', NULL, '{"SITE":{"BRANCO":23},"FENOMENAL":{"COR":28,"BRANCO":28}}'),
('p15', 'Infantil', 'CAMISETA INFANTIL', 'Camiseta Infantil', '{"SITE":{"BRANCO":9.5},"GUSHI":{"COR":13,"BRANCO":11.4,"ESPECIAL":13},"MAGIC":{"COR":12.5,"BRANCO":11.5},"INDICE":{"COR":15,"BRANCO":15}}'),
('p16', 'Infantil', 'CAMISETA INFANTIL MANGA LONGA', 'Camiseta Infantil Manga Longa', '{"SITE":{"BRANCO":15}}'),
('p17', 'Masculino', 'CAMISETA MALHA FRIA MASCULINA', NULL, '{"SITE":{"BRANCO":15},"FENOMENAL":{"COR":18,"BRANCO":18}}'),
('p18', 'Outros', 'AVENTAL DE OXFORD', NULL, '{"MAGIC":{"COR":15,"BRANCO":15},"GUSHI":{"COR":14,"BRANCO":14,"ESPECIAL":14}}'),
('p3', 'Feminino', 'BABYLOOK', 'Babylook', '{"SITE":{"BRANCO":12},"GUSHI":{"COR":16.3,"BRANCO":15,"ESPECIAL":16.3},"MAGIC":{"COR":15,"BRANCO":13.5},"MIKONOS":{"BRANCO":14.5}}'),
('p19', 'Masculino', 'CAMISETA MASCULINA', 'Camiseta Masculina', '{"SITE":{"BRANCO":12.5},"GUSHI":{"COR":20.3,"BRANCO":18.4,"ESPECIAL":21},"MAGIC":{"COR":19.5,"BRANCO":18.5},"GLOBAL":{"COR":17.5,"BRANCO":16},"MIKONOS":{"BRANCO":13.5}}'),
('p43', 'Feminino', 'MULLET GOLA V', 'Mullet Gola V', '{"INDICE":{"COR":21,"BRANCO":21}}'),
('p53', 'Feminino', 'POLO MALHA FRIA FEMININA', NULL, '{"FENOMENAL":{"COR":30,"BRANCO":30}}')
ON CONFLICT (id) DO UPDATE SET
category = EXCLUDED.category,
product = EXCLUDED.product,
sku_product_name = EXCLUDED.sku_product_name,
prices_json = EXCLUDED.prices_json;
