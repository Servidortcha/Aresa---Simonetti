-- ============================================================
-- 0014_trabajos_obra.sql
-- Asignar trabajos de corte/tornería a una obra (fabricación)
-- mediante el desplegable de Obra en el módulo Trabajos.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

alter table public.trabajos
  add column if not exists fabricacion_id bigint references public.fabricaciones(id) on delete set null;

create index if not exists trabajos_fabricacion_id_idx on public.trabajos (fabricacion_id);
