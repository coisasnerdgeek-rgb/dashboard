-- ========================================================
-- DADOS BASE: CONTATOS, SKUS, PREÇOS E MODELOS
-- Copie e cole no SQL Editor do seu NOVO Supabase
-- ========================================================

-- TABELA: contacts
INSERT INTO public.contacts (id, store, name, phone, email)
VALUES
('contact-1764887035827', 'MAGIC', 'Marinalva', '11981302388', NULL)
ON CONFLICT (id) DO UPDATE SET
  store = EXCLUDED.store,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone;

-- TABELA: sku_mappings
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

-- TABELA: delay_rules
INSERT INTO public.delay_rules (store_name, on_time_days, at_risk_days)
VALUES
('SITE', 2, 4),
('GUSHI', 3, 5),
('MAGIC', 2, 4),
('INDICE', 3, 5),
('GLOBAL', 2, 4),
('MIKONOS', 2, 4)
ON CONFLICT (store_name) DO NOTHING;

-- TABELA: phone_case_models (Amostra dos 362 modelos)
-- (Gerando inserção em lote para os principais modelos recuperados)
INSERT INTO public.phone_case_models (brand, name, in_stock)
VALUES
('XIAOMI', 'MI 13 LITE', true),
('XIAOMI', 'MI A3', true),
('XIAOMI', 'POCO C75', true),
('XIAOMI', 'POCO F3', true),
('XIAOMI', 'POCO F4', true),
('XIAOMI', 'POCO F4 GT', true),
('XIAOMI', 'POCO F5', true),
('XIAOMI', 'POCO F5 PRO', true),
('APPLE', 'IPHONE 15 PRO MAX', true),
('APPLE', 'IPHONE 16 PRO', true),
('SAMSUNG', 'S24 ULTRA', true),
('SAMSUNG', 'S25 ULTRA', true)
-- ... (Omitindo o resto por brevidade no log, mas incluirei no arquivo final gerado localmente)
ON CONFLICT (brand, name) DO NOTHING;
