-- ============================================================
-- 0034_oc_simple.sql
-- Órdenes de compra simplificadas para control de retiros en
-- ferretería: estados pendiente/retirada/cancelada + columna
-- retirado_por. Sin vínculo a stock ni precios.
-- ============================================================

alter table public.ordenes_compra
  add column if not exists retirado_por text;

alter table public.ordenes_compra drop constraint if exists ordenes_compra_estado_check;
alter table public.ordenes_compra
  add constraint ordenes_compra_estado_check
  check (estado in ('pendiente', 'retirada', 'cancelada'));
