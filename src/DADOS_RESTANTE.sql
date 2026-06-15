-- ========================================================
-- SCRIPT DE DADOS: SKU Mappings e Lotes
-- ========================================================

-- Tabela: sku_mappings
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

-- Tabela: delay_rules
INSERT INTO public.delay_rules (store_name, on_time_days, at_risk_days)
VALUES
('SITE', 2, 4),
('GUSHI', 3, 5),
('MAGIC', 2, 4),
('INDICE', 3, 5),
('GLOBAL', 2, 4),
('MIKONOS', 2, 4)
ON CONFLICT (store_name) DO NOTHING;

-- Tabela: lotes
INSERT INTO public.lotes (numero_lote, imagem_url, thumbnail, imagens)
VALUES
('5', 'https://drive.google.com/file/d/1rPC4o2YM5Dq53k57mCUpzPGsAu2-g0Sz/preview?usp=drivesdk', 'https://lh3.googleusercontent.com/drive-storage/...', ARRAY['https://drive.google.com/file/d/1rPC4o2YM5Dq53k57mCUpzPGsAu2-g0Sz/preview?usp=drivesdk']),
('7', 'https://drive.google.com/file/d/1ENtw5kkMM-ur57GHk5xZaMtJ7s54z9If/preview?usp=drivesdk', 'https://lh3.googleusercontent.com/drive-storage/...', ARRAY['https://drive.google.com/file/d/1ENtw5kkMM-ur57GHk5xZaMtJ7s54z9If/preview?usp=drivesdk']),
('4', 'https://drive.google.com/file/d/1iuKAwPGvf5AE_4zqIe1AO26Vji0pDMFu/preview?usp=drivesdk', 'https://lh3.googleusercontent.com/drive-storage/...', ARRAY['https://drive.google.com/file/d/1iuKAwPGvf5AE_4zqIe1AO26Vji0pDMFu/preview?usp=drivesdk']),
('8', 'https://drive.google.com/file/d/1I0bhiq_xxLoZXSHyE_VORT09AG0SRhfv/preview?usp=drivesdk', 'https://lh3.googleusercontent.com/drive-storage/...', ARRAY['https://drive.google.com/file/d/1I0bhiq_xxLoZXSHyE_VORT09AG0SRhfv/preview?usp=drivesdk'])
ON CONFLICT (numero_lote) DO NOTHING;
