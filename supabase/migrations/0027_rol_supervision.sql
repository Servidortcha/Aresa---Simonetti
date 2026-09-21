-- ============================================================
-- 0027_rol_supervision.sql
-- Rol "supervision" para Partes diarios: solo lectura + impresión.
-- Puede ver todos los frentes y partes, pero NO crear, editar ni
-- borrar (la escritura sigue restringida a admin y encargados).
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

create or replace function public.es_supervision()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'supervision'
  );
$$;

-- Partes diarios: supervisión puede leer todo (no escribir)
drop policy if exists "partes_diarios_select" on public.partes_diarios;
create policy "partes_diarios_select" on public.partes_diarios
  for select to authenticated
  using (public.es_admin() or public.es_supervision() or public.es_encargado_del_frente(frente_id));

-- Frentes: supervisión puede leer todos (para ver nombres/filtros)
drop policy if exists "frentes_trabajo_select_supervision" on public.frentes_trabajo;
create policy "frentes_trabajo_select_supervision" on public.frentes_trabajo
  for select to authenticated
  using (public.es_supervision());

-- Personal de frentes: supervisión puede leer (horas por persona)
drop policy if exists "frente_personas_select_encargado" on public.frente_personas;
create policy "frente_personas_select_encargado" on public.frente_personas
  for select to authenticated
  using (public.es_admin() or public.es_supervision() or public.es_encargado_del_frente(frente_id));
