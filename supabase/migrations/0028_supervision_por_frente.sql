-- ============================================================
-- 0028_supervision_por_frente.sql
-- El admin elige qué frentes puede ver cada usuario de
-- supervisión. Tabla supervision_frentes (usuario → frente) +
-- RLS que limita la lectura de supervisión a sus frentes
-- asignados + RPCs para gestionar los accesos desde la app.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

create table if not exists public.supervision_frentes (
  user_id uuid not null references auth.users(id) on delete cascade,
  frente_id uuid not null references public.frentes_trabajo(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, frente_id)
);

create index if not exists supervision_frentes_frente_idx on public.supervision_frentes (frente_id);

alter table public.supervision_frentes enable row level security;

drop policy if exists "supervision_frentes_admin_all" on public.supervision_frentes;
create policy "supervision_frentes_admin_all" on public.supervision_frentes
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "supervision_frentes_select_own" on public.supervision_frentes;
create policy "supervision_frentes_select_own" on public.supervision_frentes
  for select to authenticated
  using (user_id = auth.uid());

-- ¿La supervisión logueada tiene acceso a este frente?
create or replace function public.es_supervision_del_frente(p_frente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supervision_frentes
    where user_id = auth.uid() and frente_id = p_frente_id
  );
$$;

-- Partes: supervisión solo ve sus frentes asignados
drop policy if exists "partes_diarios_select" on public.partes_diarios;
create policy "partes_diarios_select" on public.partes_diarios
  for select to authenticated
  using (
    public.es_admin()
    or public.es_encargado_del_frente(frente_id)
    or (public.es_supervision() and public.es_supervision_del_frente(frente_id))
  );

-- Frentes: supervisión solo ve sus frentes asignados
drop policy if exists "frentes_trabajo_select_supervision" on public.frentes_trabajo;
create policy "frentes_trabajo_select_supervision" on public.frentes_trabajo
  for select to authenticated
  using (public.es_supervision_del_frente(id));

-- Personal: supervisión solo ve el de sus frentes asignados
drop policy if exists "frente_personas_select_encargado" on public.frente_personas;
create policy "frente_personas_select_encargado" on public.frente_personas
  for select to authenticated
  using (
    public.es_admin()
    or public.es_encargado_del_frente(frente_id)
    or (public.es_supervision() and public.es_supervision_del_frente(frente_id))
  );

-- Lista de accesos (solo admin): email + frente
create or replace function public.lista_supervision_accesos()
returns table (user_id uuid, email text, frente_id uuid, frente_nombre text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol <> 'admin' then
    raise exception 'Solo el administrador puede ver los accesos.';
  end if;
  return query
    select sf.user_id, u.email::text, sf.frente_id, f.nombre
    from public.supervision_frentes sf
    join auth.users u on u.id = sf.user_id
    join public.frentes_trabajo f on f.id = sf.frente_id
    order by u.email, f.nombre;
end;
$$;

revoke all on function public.lista_supervision_accesos() from public;
grant execute on function public.lista_supervision_accesos() to authenticated;

-- Otorgar acceso a un frente (solo admin, por email)
create or replace function public.asignar_frente_supervision(p_email text, p_frente_id uuid)
returns table (ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_uid uuid;
  v_frente text;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol <> 'admin' then
    return query select false, 'Solo el administrador puede asignar accesos.';
    return;
  end if;

  select id into v_uid from auth.users where email = p_email;
  if not found then
    return query select false, 'No existe un usuario con ese correo.';
    return;
  end if;

  select nombre into v_frente from public.frentes_trabajo where id = p_frente_id;
  if not found then
    return query select false, 'El frente no existe.';
    return;
  end if;

  insert into public.supervision_frentes (user_id, frente_id)
  values (v_uid, p_frente_id)
  on conflict do nothing;

  return query select true, 'Acceso otorgado.';
end;
$$;

revoke all on function public.asignar_frente_supervision(text, uuid) from public;
grant execute on function public.asignar_frente_supervision(text, uuid) to authenticated;

-- Quitar acceso a un frente (solo admin)
create or replace function public.quitar_frente_supervision(p_user_id uuid, p_frente_id uuid)
returns table (ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol <> 'admin' then
    return query select false, 'Solo el administrador puede quitar accesos.';
    return;
  end if;

  delete from public.supervision_frentes
  where user_id = p_user_id and frente_id = p_frente_id;

  return query select true, 'Acceso quitado.';
end;
$$;

revoke all on function public.quitar_frente_supervision(uuid, uuid) from public;
grant execute on function public.quitar_frente_supervision(uuid, uuid) to authenticated;
