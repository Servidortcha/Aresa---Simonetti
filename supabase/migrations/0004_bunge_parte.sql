-- ============================================================
-- 0004_bunge_parte.sql
-- Campos extra de Bunge Tancacha en partes diarios
-- (se muestran solo cuando el frente es Bunge Tancacha)
-- ============================================================

alter table public.partes_diarios
  add column if not exists numero_parte_bunge text;

alter table public.partes_diarios
  add column if not exists horas_por_persona jsonb;
