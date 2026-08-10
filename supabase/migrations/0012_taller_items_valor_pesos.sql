-- ============================================================
-- 0012_taller_items_valor_pesos.sql
-- Valor en pesos para los ítems externos anexados a los trabajos
-- de Taller.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

alter table public.taller_trabajo_items
  add column if not exists valor_pesos numeric;
