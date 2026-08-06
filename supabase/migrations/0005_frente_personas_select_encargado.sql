-- ============================================================
-- 0005_frente_personas_select_encargado.sql
-- Los encargados deben poder leer el personal asignado a su
-- frente para que aparezca en el parte diario (ej: Bunge).
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

drop policy if exists "frente_personas_select_encargado" on public.frente_personas;
create policy "frente_personas_select_encargado" on public.frente_personas
  for select to authenticated
  using (public.es_admin() or public.es_encargado_del_frente(frente_id));
