-- ============================================================
-- 0030_fix_lista_usuarios.sql
-- Corrige "column reference rol is ambiguous" en lista_usuarios
-- calificando la columna de perfiles.
-- ============================================================

create or replace function public.lista_usuarios()
returns table (user_id uuid, email text, creado timestamptz, rol text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  select p.rol into v_rol from public.perfiles p where p.id = auth.uid();
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
