-- ============================================================
-- 0029_admin_usuarios.sql
-- Panel de usuarios para el admin: listar cuentas, asignar roles
-- y vincular encargados a frentes, sin pasar por Supabase.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

-- Lista de usuarios con su rol (solo admin)
create or replace function public.lista_usuarios()
returns table (user_id uuid, email text, creado timestamptz, rol text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol <> 'admin' then
    raise exception 'Solo el administrador puede ver los usuarios.';
  end if;
  return query
    select u.id, u.email::text, u.created_at, p.rol
    from auth.users u
    left join public.perfiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;

revoke all on function public.lista_usuarios() from public;
grant execute on function public.lista_usuarios() to authenticated;

-- Asignar o cambiar el rol de un usuario por email (solo admin)
create or replace function public.asignar_rol(p_email text, p_rol text)
returns table (ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_uid uuid;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();
  if v_rol is null or v_rol <> 'admin' then
    return query select false, 'Solo el administrador puede asignar roles.';
    return;
  end if;

  if p_rol not in ('admin', 'taller_stock', 'encargado', 'operario', 'grua', 'supervision') then
    return query select false, 'Rol inválido.';
    return;
  end if;

  select id into v_uid from auth.users where email = p_email;
  if not found then
    return query select false, 'No existe un usuario con ese correo. Primero tiene que registrarse.';
    return;
  end if;

  insert into public.perfiles (id, rol)
  values (v_uid, p_rol)
  on conflict (id) do update set rol = excluded.rol;

  return query select true, 'Rol asignado.';
end;
$$;

revoke all on function public.asignar_rol(text, text) from public;
grant execute on function public.asignar_rol(text, text) to authenticated;

-- Vincular un usuario como encargado de un frente (solo admin)
create or replace function public.vincular_encargado_frente(p_email text, p_frente_id uuid)
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
    return query select false, 'Solo el administrador puede vincular encargados.';
    return;
  end if;

  select id into v_uid from auth.users where email = p_email;
  if not found then
    return query select false, 'No existe un usuario con ese correo. Primero tiene que registrarse.';
    return;
  end if;

  select nombre into v_frente from public.frentes_trabajo where id = p_frente_id;
  if not found then
    return query select false, 'El frente no existe.';
    return;
  end if;

  update public.frentes_trabajo
  set encargado_user_id = v_uid
  where id = p_frente_id;

  return query select true, 'Encargado vinculado.';
end;
$$;

revoke all on function public.vincular_encargado_frente(text, uuid) from public;
grant execute on function public.vincular_encargado_frente(text, uuid) to authenticated;
