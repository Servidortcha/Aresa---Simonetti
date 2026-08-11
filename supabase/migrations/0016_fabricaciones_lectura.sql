-- ============================================================
-- 0016_fabricaciones_lectura.sql
-- Habilita la lectura de obras (fabricaciones) para todos los
-- usuarios autenticados, así aparecen las obras abiertas en los
-- desplegables de obra (Trabajos e Ingreso/Egreso).
--
-- El resto de operaciones (crear, editar, cerrar, eliminar)
-- siguen siendo solo de administrador.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

drop policy if exists "fabricaciones_select_todos" on public.fabricaciones;
create policy "fabricaciones_select_todos" on public.fabricaciones
  for select to authenticated
  using (true);
