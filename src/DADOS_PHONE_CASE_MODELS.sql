-- ========================================================
-- SCRIPT DE DADOS: phone_case_models
-- Execute no SQL Editor do NOVO projeto.
-- ========================================================

-- Limpar dados se necessário
-- DELETE FROM public.phone_case_models;

INSERT INTO public.phone_case_models (id, brand, name, in_stock, created_at)
VALUES
('e6f84a59-372e-462d-abfe-b53c8193c14b', 'XIAOMI', 'MI 11T PRO', false, '2025-12-23 01:43:38.861763+00'),
('6001e860-e04b-410f-a8aa-5ab3d86ecb58', 'SAMSUNG', 'A01', true, '2025-12-05 02:56:59.692306+00'),
('1ef463e0-fa1c-4c92-a4a0-f1aee2c693f8', 'XIAOMI', 'MI 12T PRO', false, '2025-12-23 01:43:38.861763+00'),
('15208635-da62-4362-a0f9-d08224c3cab9', 'XIAOMI', 'MI 8', true, '2025-12-23 01:43:38.861763+00'),
('90e5e43f-6def-4d19-a019-b132eb55a028', 'XIAOMI', 'MI 9 LITE', true, '2025-12-23 01:43:38.861763+00'),
('123b7938-3268-44fd-82a3-de0aad1525f2', 'XIAOMI', 'MI 9T', true, '2025-12-23 01:43:38.861763+00'),
('d509e680-12f9-4723-b042-0ac80d95a58c', 'XIAOMI', 'MI 10 LITE', true, '2025-12-23 01:43:38.861763+00'),
('e155c8b3-1919-444b-bdf9-b4992b2b3844', 'XIAOMI', 'MI 11 LITE', true, '2025-12-23 01:43:38.861763+00'),
('2c6b081a-a8df-46af-a130-0cec75726201', 'XIAOMI', 'MI 11T', true, '2025-12-23 01:43:38.861763+00'),
('924655b2-7405-482b-910d-953173945ec8', 'XIAOMI', 'MI 12 LITE', true, '2025-12-23 01:43:38.861763+00'),
('a0301ec7-d24d-499d-b2e8-e93f759f74c0', 'XIAOMI', 'MI 13', true, '2025-12-23 01:43:38.861763+00'),
('2909e8d9-33cf-4feb-a03f-73f9cd901f9c', 'MOTOROLA', 'MOTO G56', true, '2026-01-07 13:05:46.599958+00'),
('4ed21352-d49d-4838-b2ac-f832d450e562', 'SAMSUNG', 'M55', true, '2026-01-08 00:00:47.355272+00'),
('d414a5b0-cae3-4b15-bad2-2dc12aafaee2', 'MOTOROLA', 'MOTO G75', true, '2026-01-09 13:09:00.666057+00'),
('3c87ba5e-ee36-4f3b-906f-c33a5b281054', 'MOTOROLA', 'MOTO G06', true, '2026-01-12 00:20:38.742094+00'),
('0e885e6d-4054-4f8d-9bb2-7a7c20ed808f', 'XIAOMI', 'REDMI A5', true, '2026-01-12 00:24:56.668217+00')
ON CONFLICT (id) DO UPDATE SET
brand = EXCLUDED.brand,
name = EXCLUDED.name,
in_stock = EXCLUDED.in_stock;
