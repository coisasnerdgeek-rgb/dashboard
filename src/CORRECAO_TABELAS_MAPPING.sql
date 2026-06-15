-- ========================================================
-- CORREÇÃO DE TABELAS FALTANTES E RESTAURAÇÃO DE DADOS (V3)
-- Copie e cole no SQL Editor do seu NOVO Supabase
-- ========================================================

-- 1. Criar tabelas faltantes que estão causando erro no console
CREATE TABLE IF NOT EXISTS public.tracking_mappings (
    order_id text NOT NULL PRIMARY KEY,
    tracking_code text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.image_mappings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sku text NOT NULL,
    url text NOT NULL,
    category_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.spreadsheet_data (
    order_id text NOT NULL PRIMARY KEY,
    data_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Habilitar RLS para segurança
ALTER TABLE public.tracking_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_data ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de Acesso
DROP POLICY IF EXISTS "Enable all access for anon" ON public.tracking_mappings;
CREATE POLICY "Enable all access for anon" ON public.tracking_mappings FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON public.image_mappings;
CREATE POLICY "Enable all access for anon" ON public.image_mappings FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for anon" ON public.spreadsheet_data;
CREATE POLICY "Enable all access for anon" ON public.spreadsheet_data FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. Restaurar dados de Configurações do App
INSERT INTO public.app_settings (key, value)
VALUES
('orders_sheet_url', '"https://docs.google.com/spreadsheets/d/1vA5W0D_9qR_J9v6S0oD5_8vG6S0oD5_8v/edit"'),
('production_sheet_url', '"https://docs.google.com/spreadsheets/d/1X5W0D_9qR_J9v6S0oD5_8vG6S0oD5_8v/edit"'),
('googleDriveFolderId', '"1RDRd_3cB0c2POtInQoPh9cbAwh7Ip8AZ"'),
('googleDriveFolderId_Atual', '"1npMWcDmlPPboLXX-PFV8GaUftk_Ey-Xn"'),
('googleDriveFolderId_Backup', '"1Wp9ZbBEI72wr4wjlxH9RN3zJNGmnWHxv"'),
('googleDriveFolderId_Estampas', '"1lMG_Hv0hY7v7KFKuV0TghYZJwYqhch7_"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. Restaurar Lotes recentes
INSERT INTO public.lotes (id, imagem_url, imagens, numero_lote, thumbnail)
VALUES
('acb4b1ef-8710-4a99-854f-ae17fa59b697', 'https://drive.google.com/file/d/1rPC4o2YM5Dq53k57mCUpzPGsAu2-g0Sz/preview?usp=drivesdk', '{"https://drive.google.com/file/d/1rPC4o2YM5Dq53k57mCUpzPGsAu2-g0Sz/preview?usp=drivesdk", "https://drive.google.com/file/d/1xxGUXxzwdTP27hRqKXRsD7GW0hXRb4bw/preview?usp=drivesdk", "https://drive.google.com/file/d/1kIWz0ZayNAsG_IFzd9LCGF-5NbYq7QZ3/preview?usp=drivesdk"}', '5', 'https://lh3.googleusercontent.com/drive-storage/AJQWtBOo_PFAZy2v9OsXrDs3WHFiwnW7-9hRaMTCLs_sUlNepYc70fWln3SrIomnX7Kec5XlgHVSmTsRCE7NZiHBjc4jPsCE0qcWiAJ2WZynXCz_uLPiYw=s220'),
('81416fff-cea4-4475-bc4c-1f8a9c99df03', 'https://drive.google.com/file/d/1ENtw5kkMM-ur57GHk5xZaMtJ7s54z9If/preview?usp=drivesdk', '{"https://drive.google.com/file/d/1ENtw5kkMM-ur57GHk5xZaMtJ7s54z9If/preview?usp=drivesdk", "https://drive.google.com/file/d/1QCqo8iFJ5HL6TDCjHYmwx_bQQPCCMMcV/preview?usp=drivesdk", "https://drive.google.com/file/d/1dZdU1YrYymVRcLGZtpTqIjFXsQY9wk9n/preview?usp=drivesdk", "https://drive.google.com/file/d/1wPY56DfIoBpefxlpL2qmhWmfjq9dQHHi/preview?usp=drivesdk"}', '7', 'https://lh3.googleusercontent.com/drive-storage/AJQWtBO267R4GylgVL7jkfxp3vu5WwmHCI-vvtNnhCCM2eK6TW_J5-hlEVUiJct1WLUqo3q7_6Tk2QFCUEK51t7vX6DIfIj9zvjvLyyJFO_FJtnSMiWp=s220'),
('6d174152-2938-4151-845b-01577791ceee', 'https://drive.google.com/file/d/1iuKAwPGvf5AE_4zqIe1AO26Vji0pDMFu/preview?usp=drivesdk', '{"https://drive.google.com/file/d/1iuKAwPGvf5AE_4zqIe1AO26Vji0pDMFu/preview?usp=drivesdk"}', '4', 'https://lh3.googleusercontent.com/drive-storage/AJQWtBN43_iK9txdZn_FTnq22tyRodj5gocQDNCiFDe_4qoyr_Oc-r-rn4yLgbJJ6n6YCWtS_mBqvnv0xV9_PKmjupMuCuFXnN5YyYp8ZRdh0xsZueqa=s220'),
('07340ea6-09d1-4285-9da5-a95c5b6e18ac', 'https://drive.google.com/file/d/1I0bhiq_xxLoZXSHyE_VORT09AG0SRhfv/preview?usp=drivesdk', '{"https://drive.google.com/file/d/1I0bhiq_xxLoZXSHyE_VORT09AG0SRhfv/preview?usp=drivesdk"}', '8', 'https://lh3.googleusercontent.com/drive-storage/AJQWtBMzXQkWzYZXIcQKairRRnYtSwcxVM29Xhjptg5PeItDBQta_rhl_RpNk-vyowAeXcteQSeEcLmthPh0QEWN2QdzQaahH3S1fjlxamB7zQptgDsaNg=s220')
ON CONFLICT (numero_lote) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagens = EXCLUDED.imagens,
  thumbnail = EXCLUDED.thumbnail;

-- 6. Status de Verificação
INSERT INTO public.verification_status (order_id, status, status_json)
VALUES
('Polo Feminina-GUSHI-Ambos-1766173645584-0.5377920770651282', 'verified', '{"items": {"Pink": {"G": {"expected": 1, "received": 1}, "M": {"expected": 8, "received": 8}, "P": {"expected": 0, "received": 0}, "GG": {"expected": 1, "received": 1}, "XG": {"expected": 0, "received": 0}}, "Roxo": {"G": {"expected": 1, "received": 1}, "M": {"expected": 5, "received": 5}, "P": {"expected": 2, "received": 2}, "GG": {"expected": 3, "received": 3}, "XG": {"expected": 0, "received": 0}}, "Musgo": {"G": {"expected": 4, "received": 4}, "M": {"expected": 0, "received": 0}, "P": {"expected": 0, "received": 0}, "GG": {"expected": 9, "received": 9}, "XG": {"expected": 0, "received": 0}}, "Preto": {"G": {"expected": 7, "received": 7}, "M": {"expected": 15, "received": 15}, "P": {"expected": 14, "received": 14}, "GG": {"expected": 5, "received": 5}, "XG": {"expected": 0, "received": 0}}, "Royal": {"G": {"expected": 6, "received": 6}, "M": {"expected": 6, "received": 6}, "P": {"expected": 1, "received": 1}, "GG": {"expected": 1, "received": 1}, "XG": {"expected": 0, "received": 0}}, "Verde": {"G": {"expected": 11, "received": 11}, "M": {"expected": 3, "received": 3}, "P": {"expected": 5, "received": 5}, "GG": {"expected": 12, "received": 12}, "XG": {"expected": 0, "received": 0}}, "Vinho": {"G": {"expected": 0, "received": 0}, "M": {"expected": 3, "received": 3}, "P": {"expected": 0, "received": 0}, "GG": {"expected": 0, "received": 0}, "XG": {"expected": 0, "received": 0}}, "Branco": {"G": {"expected": 12, "received": 12}, "M": {"expected": 8, "received": 8}, "P": {"expected": 3, "received": 3}, "GG": {"expected": 8, "received": 8}, "XG": {"expected": 1, "received": 1}}, "Chumbo": {"G": {"expected": 1, "received": 1}, "M": {"expected": 1, "received": 1}, "P": {"expected": 0, "received": 0}, "GG": {"expected": 6, "received": 6}, "XG": {"expected": 1, "received": 1}}, "Mescla": {"G": {"expected": 2, "received": 2}, "M": {"expected": 3, "received": 3}, "P": {"expected": 5, "received": 5}, "GG": {"expected": 6, "received": 6}, "XG": {"expected": 1, "received": 1}}, "Laranja": {"G": {"expected": 2, "received": 2}, "M": {"expected": 3, "received": 3}, "P": {"expected": 0, "received": 0}, "GG": {"expected": 0, "received": 0}, "XG": {"expected": 0, "received": 0}}, "Marinho": {"G": {"expected": 3, "received": 3}, "M": {"expected": 13, "received": 13}, "P": {"expected": 2, "received": 2}, "GG": {"expected": 3, "received": 3}, "XG": {"expected": 5, "received": 5}}, "Vermelho": {"G": {"expected": 5, "received": 5}, "M": {"expected": 3, "received": 3}, "P": {"expected": 5, "received": 5}, "GG": {"expected": 2, "received": 2}, "XG": {"expected": 0, "received": 0}}, "Rosa Beb\u00ea": {"G": {"expected": 0, "received": 0}, "M": {"expected": 4, "received": 4}, "P": {"expected": 0, "received": 0}, "GG": {"expected": 3, "received": 3}, "XG": {"expected": 0, "received": 0}}}, "notes": "", "status": "verified", "lastChecked": "2025-12-19T19:48:53.411Z"}'),
('Moletom Ziper-ML VEST-Todos-1767702133295-0.634430600708419', 'verified', '{"items": {"Preto": {"G": {"expected": 3, "received": 3}, "GG": {"expected": 2, "received": 2}}}, "notes": "", "status": "verified", "lastChecked": "2026-01-07T09:50:42.860Z"}'),
('Regata-ML VEST-Todos-1767701037080-0.9434907377707308', 'verified', '{"items": {"Musgo": {"M": {"expected": 0, "received": null}}, "Preto": {"M": {"expected": 0, "received": null}, "GG": {"expected": 0, "received": null}}, "Royal": {"M": {"expected": 0, "received": null}}, "Vinho": {"GG": {"expected": 0, "received": null}}, "Branco": {"G": {"expected": 0, "received": null}, "GG": {"expected": 0, "received": null}}, "Chumbo": {"M": {"expected": 0, "received": null}}, "Mescla": {"G": {"expected": 0, "received": null}}, "Turquesa": {"M": {"expected": 1, "received": 1}}}, "notes": "", "status": "verified", "lastChecked": "2026-01-07T09:51:05.464Z"}'),
('Camiseta Masculina V-ML VEST-Todos-1767701153163-0.42846509851875936', 'verified', '{"items": {"Preto": {"G": {"expected": 0, "received": null}, "P": {"expected": 2, "received": 2}}, "Royal": {"G": {"expected": 2, "received": 2}}, "Vinho": {"G": {"expected": 0, "received": null}}, "Branco": {"G": {"expected": 0, "received": null}, "M": {"expected": 0, "received": null}, "GG": {"expected": 0, "received": null}}}, "notes": "", "status": "verified", "lastChecked": "2026-01-07T09:51:17.527Z"}')
ON CONFLICT (order_id) DO UPDATE SET
  status = EXCLUDED.status,
  status_json = EXCLUDED.status_json;
