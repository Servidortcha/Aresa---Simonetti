-- ============================================================
-- 0035_rol_compras.sql
-- Rol "compras": solo puede operar Remitos y Órdenes de compra
-- (lectura y escritura). No ve ningún otro módulo.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('admin', 'subadmin', 'taller_stock', 'encargado', 'operario', 'grua', 'supervision', 'compras'));

create or replace function public.es_compras()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'compras'
  );
$$;

drop policy if exists "remitos_gestion_all" on public.remitos;
create policy "remitos_gestion_all" on public.remitos
  for all to authenticated
  using (public.es_gestion() or public.es_compras())
  with check (public.es_gestion() or public.es_compras());

drop policy if exists "remito_items_gestion_all" on public.remito_items;
create policy "remito_items_gestion_all" on public.remito_items
  for all to authenticated
  using (public.es_gestion() or public.es_compras())
  with check (public.es_gestion() or public.es_compras());

drop policy if exists "ordenes_compra_gestion_all" on public.ordenes_compra;
create policy "ordenes_compra_gestion_all" on public.ordenes_compra
  for all to authenticated
  using (public.es_gestion() or public.es_compras())
  with check (public.es_gestion() or public.es_compras());

drop policy if exists "orden_compra_items_gestion_all" on public.orden_compra_items;
create policy "orden_compra_items_gestion_all" on public.orden_compra_items
  for all to authenticated
  using (public.es_gestion() or public.es_compras())
  with check (public.es_gestion() or public.es_compras());

-- asignar_rol: agregar 'compras' a los roles válidos
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

  if p_rol not in ('admin', 'subadmin', 'taller_stock', 'encargado', 'operario', 'grua', 'supervision', 'compras') then
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
