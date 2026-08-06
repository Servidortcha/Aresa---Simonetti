-- ============================================================
-- 0003_partes_diarios.sql
-- Partes diarios de los frentes de trabajo
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
--
-- Pasos MANUALES que quedan (vía dashboard, no por SQL):
--   1) Auth → Add user: crear cuenta (correo + contraseña) para
--      cada encargado de frente.
--   2) Ejecutar el bloque "Vincular encargados" (al final, reem-
--      plazando correo y nombre de frente).
--   3) Storage → New bucket: crear bucket "partes-diarios" (público).
--   4) Storage → bucket "partes-diarios" → Policies → New policy →
--      Custom: marcar las 4 operaciones y usar esta expresión:
--
--        bucket_id = 'partes-diarios' AND (
--          public.es_admin() OR public.es_encargado_del_frente((storage.foldername(name))[1]::uuid)
--        )
-- ============================================================

-- 1) Vincular cada frente con la cuenta de su encargado
alter table public.frentes_trabajo
  add column if not exists encargado_user_id uuid references auth.users(id);

-- 2) Tabla de partes diarios
create table if not exists public.partes_diarios (
  id uuid primary key default gen_random_uuid(),
  frente_id uuid not null references public.frentes_trabajo(id) on delete cascade,
  fecha date not null default current_date,
  tareas text,
  novedades text,
  archivos jsonb default null,
  usuario_email text,
  created_at timestamptz not null default now()
);

create index if not exists partes_diarios_frente_id_idx on public.partes_diarios (frente_id);
create index if not exists partes_diarios_fecha_idx on public.partes_diarios (fecha);

-- 3) Función auxiliar: ¿el usuario logueado es el encargado del frente?
create or replace function public.es_encargado_del_frente(p_frente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.frentes_trabajo
    where id = p_frente_id and encargado_user_id = auth.uid()
  );
$$;

-- 4) RLS: admin puede todo; cada encargado solo su frente
alter table public.partes_diarios enable row level security;

drop policy if exists "partes_diarios_select" on public.partes_diarios;
create policy "partes_diarios_select" on public.partes_diarios
  for select to authenticated
  using (public.es_admin() or public.es_encargado_del_frente(frente_id));

drop policy if exists "partes_diarios_insert" on public.partes_diarios;
create policy "partes_diarios_insert" on public.partes_diarios
  for insert to authenticated
  with check (public.es_admin() or public.es_encargado_del_frente(frente_id));

drop policy if exists "partes_diarios_update" on public.partes_diarios;
create policy "partes_diarios_update" on public.partes_diarios
  for update to authenticated
  using (public.es_admin() or public.es_encargado_del_frente(frente_id))
  with check (public.es_admin() or public.es_encargado_del_frente(frente_id));

drop policy if exists "partes_diarios_delete" on public.partes_diarios;
create policy "partes_diarios_delete" on public.partes_diarios
  for delete to authenticated
  using (public.es_admin() or public.es_encargado_del_frente(frente_id));

-- ------------------------------------------------------------
-- VINCULAR ENCARGADOS (ejecutar manualmente por cada encargado,
-- reemplazando el correo y el nombre del frente)
-- ------------------------------------------------------------
-- insert into public.perfiles (id, rol)
-- select id, 'encargado' from auth.users where email = 'correo@del-encargado.com'
-- on conflict (id) do update set rol = 'encargado';
--
-- update public.frentes_trabajo
-- set encargado_user_id = (select id from auth.users where email = 'correo@del-encargado.com')
-- where nombre = 'Nombre del frente';
