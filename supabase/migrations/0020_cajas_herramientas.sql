-- ============================================================
-- 0020_cajas_herramientas.sql
-- Cajas de herramientas para el frente Gral. Villegas (usuario
-- zeballes@simonetti.local, rol encargado). Cada caja es un
-- insumo en el depósito "Gral. Villegas" visible solo para su
-- encargado en el módulo Stock.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

insert into public.insumos (nombre, categoria, unidad, stock, minimo, deposito, activo)
select nombre, categoria, unidad, stock, minimo, deposito, activo from (values
  ('Caja de herramientas 1 - Gral. Villegas', 'Herramientas', 'unid', 1, 1, 'Gral. Villegas', true),
  ('Caja de herramientas 2 - Gral. Villegas', 'Herramientas', 'unid', 1, 1, 'Gral. Villegas', true),
  ('Caja de herramientas 3 - Gral. Villegas', 'Herramientas', 'unid', 1, 1, 'Gral. Villegas', true)
) as v(nombre, categoria, unidad, stock, minimo, deposito, activo)
where not exists (
  select 1 from public.insumos where deposito = 'Gral. Villegas' and nombre like 'Caja de herramientas%'
);
