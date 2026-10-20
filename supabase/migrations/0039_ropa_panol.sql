-- ============================================================
-- 0039_ropa_panol.sql
-- Ropa de trabajo como insumos del depósito Pañol: columna
-- talle (y es_ropa para filtrar). Con esto se carga el stock de
-- prendas en Stock Pañol y se registran las entregas en la misma
-- sección.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

alter table public.insumos
  add column if not exists talle text,
  add column if not exists es_ropa boolean not null default false;
