-- ========================================================
-- MIGRACAO DE DADOS: SKU MAPPINGS (Projeto Antigo -> Novo)
-- ========================================================

INSERT INTO public.sku_mappings (mapping_type, mapping_key, mapping_value)
VALUES
('color', 'polo', 'Rosa Bebê'),
('product', 'starwars', 'Camiseta Masculina'),
('color', 'chefao', 'Preto'),
('product', 'sonic', 'Camiseta Masculina'),
('color', 'skull', 'Marinho'),
('color', 'cam', 'Branco'),
('product', 'cami', 'Camiseta Masculina'),
('color', 'masc', 'Musgo'),
('product', 'megaman', 'Camiseta Masculina'),
('color', 'plus', 'Branco'),
('product', 'stray kids way', 'Babylook Poliester'),
('product', 'you make stray kids stay', 'Babylook Poliester'),
('color', 'polia', 'Turquesa'),
('product', 'joker', 'Camiseta Masculina'),
('color', 'coke', 'Preto'),
('color', 'sublima', 'Branco'),
('size', 'n', 'M'),
('size', 'mm', 'M'),
('color', 'superman', 'Preto')
ON CONFLICT (mapping_type, mapping_key) DO NOTHING;
