-- ============================================================
-- 0001_seguridad.sql
-- Seguridad de Inventario ERP (Aresa / Simonetti)
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo. (También podés usar `supabase db push`
-- si usás la CLI.)
-- ------------------------------------------------------------
-- Contenido:
--   1) Funciones auxiliares de rol (evitan recursión en RLS)
--   2) Row Level Security (RLS) en todas las tablas
--   3) RPC atómico para movimientos de stock
--   4) RLS en Storage (taller-archivos / trabajos-archivos)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Funciones auxiliares de rol
-- ------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

create or replace function public.es_admin_o_taller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol in ('admin', 'taller_stock')
  );
$$;

-- ------------------------------------------------------------
-- 2) Row Level Security
-- ------------------------------------------------------------

-- perfiles: cada usuario ve su propia fila; el admin lo gestiona
alter table public.perfiles enable row level security;

drop policy if exists "perfiles_select_own_or_admin" on public.perfiles;
create policy "perfiles_select_own_or_admin" on public.perfiles
  for select
  using (auth.uid() = id or public.es_admin());

drop policy if exists "perfiles_admin_write" on public.perfiles;
create policy "perfiles_admin_write" on public.perfiles
  for all
  using (public.es_admin())
  with check (public.es_admin());

-- insumos: lectura para cualquier usuario logueado, escritura solo admin
alter table public.insumos enable row level security;

drop policy if exists "insumos_select_authenticated" on public.insumos;
create policy "insumos_select_authenticated" on public.insumos
  for select to authenticated
  using (true);

drop policy if exists "insumos_admin_write" on public.insumos;
create policy "insumos_admin_write" on public.insumos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- movimientos: lectura para cualquier usuario logueado.
-- La escritura de movimientos se hace SOLO vía el RPC
-- registrar_movimiento_insumo (transacción atómica + validación
-- de roles). Escritura directa: solo admin.
alter table public.movimientos enable row level security;

drop policy if exists "movimientos_select_authenticated" on public.movimientos;
create policy "movimientos_select_authenticated" on public.movimientos
  for select to authenticated
  using (true);

drop policy if exists "movimientos_admin_write" on public.movimientos;
create policy "movimientos_admin_write" on public.movimientos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- trabajos: lectura autenticada; alta/edición admin o taller_stock
alter table public.trabajos enable row level security;

drop policy if exists "trabajos_select_authenticated" on public.trabajos;
create policy "trabajos_select_authenticated" on public.trabajos
  for select to authenticated
  using (true);

drop policy if exists "trabajos_insert_admin_o_taller" on public.trabajos;
create policy "trabajos_insert_admin_o_taller" on public.trabajos
  for insert to authenticated
  with check (public.es_admin_o_taller());

drop policy if exists "trabajos_update_admin_o_taller" on public.trabajos;
create policy "trabajos_update_admin_o_taller" on public.trabajos
  for update to authenticated
  using (public.es_admin_o_taller())
  with check (public.es_admin_o_taller());

drop policy if exists "trabajos_admin_delete" on public.trabajos;
create policy "trabajos_admin_delete" on public.trabajos
  for delete to authenticated
  using (public.es_admin());

-- taller_trabajos: lectura autenticada, escritura solo admin
alter table public.taller_trabajos enable row level security;

drop policy if exists "taller_trabajos_select_authenticated" on public.taller_trabajos;
create policy "taller_trabajos_select_authenticated" on public.taller_trabajos
  for select to authenticated
  using (true);

drop policy if exists "taller_trabajos_admin_write" on public.taller_trabajos;
create policy "taller_trabajos_admin_write" on public.taller_trabajos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- ------------------------------------------------------------
-- RRHH (datos sensibles: sueldos, CUIL, bancos): solo admin
-- ------------------------------------------------------------
alter table public.empleados enable row level security;

drop policy if exists "empleados_admin_all" on public.empleados;
create policy "empleados_admin_all" on public.empleados
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

alter table public.conceptos enable row level security;

drop policy if exists "conceptos_admin_all" on public.conceptos;
create policy "conceptos_admin_all" on public.conceptos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

alter table public.liquidaciones enable row level security;

drop policy if exists "liquidaciones_admin_all" on public.liquidaciones;
create policy "liquidaciones_admin_all" on public.liquidaciones
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

alter table public.liquidacion_detalle enable row level security;

drop policy if exists "liquidacion_detalle_admin_all" on public.liquidacion_detalle;
create policy "liquidacion_detalle_admin_all" on public.liquidacion_detalle
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- ------------------------------------------------------------
-- 3) RPC: movimiento de stock atómico
--    Registra el movimiento Y actualiza el stock en una sola
--    transacción, con validación de stock y de roles.
-- ------------------------------------------------------------
create or replace function public.registrar_movimiento_insumo(
  p_insumo_id bigint,
  p_tipo text,
  p_cantidad numeric,
  p_producto_texto text default null,
  p_nota text default null,
  p_usuario_email text default null
)
returns table (ok boolean, mensaje text, nuevo_stock numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric;
  v_nuevo numeric;
  v_unidad text;
  v_nombre text;
  v_rol text;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();

  if v_rol is null then
    return query select false, 'Usuario sin rol asignado. Revisá la tabla perfiles.', null::numeric;
    return;
  end if;

  if p_tipo not in ('entrada', 'salida') then
    return query select false, 'Tipo de movimiento inválido.', null::numeric;
    return;
  end if;

  -- Solo el admin puede registrar entradas de stock
  if p_tipo = 'entrada' and v_rol <> 'admin' then
    return query select false, 'Solo el administrador puede registrar entradas.', null::numeric;
    return;
  end if;

  -- Bloquea la fila para evitar condiciones de carrera
  select stock, unidad, nombre into v_stock, v_unidad, v_nombre
  from public.insumos
  where id = p_insumo_id
  for update;

  if not found then
    return query select false, 'El insumo no existe.', null::numeric;
    return;
  end if;

  if p_tipo = 'entrada' then
    v_nuevo := v_stock + p_cantidad;
  else
    if p_cantidad > v_stock then
      return query select false, format('No hay suficiente stock: quedan %s %s de %s.', v_stock, v_unidad, v_nombre), null::numeric;
      return;
    end if;
    v_nuevo := v_stock - p_cantidad;
  end if;

  insert into public.movimientos (insumo_id, tipo, cantidad, producto_texto, nota, usuario_email, stock_resultante)
  values (p_insumo_id, p_tipo, p_cantidad, p_producto_texto, p_nota, p_usuario_email, v_nuevo);

  update public.insumos
  set stock = v_nuevo
  where id = p_insumo_id;

  return query select true, 'Movimiento registrado.', v_nuevo;
end;
$$;

revoke all on function public.registrar_movimiento_insumo(bigint, text, numeric, text, text, text) from public;
grant execute on function public.registrar_movimiento_insumo(bigint, text, numeric, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 4) Storage: los archivos siguen siendo públicos de lectura
--    (necesario para getPublicUrl), pero la subida y borrado
--    quedan restringidos a usuarios autenticados.
-- ------------------------------------------------------------
alter table storage.objects enable row level security;

drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read" on storage.objects
  for select
  using (bucket_id in ('taller-archivos', 'trabajos-archivos'));

drop policy if exists "storage_authenticated_insert" on storage.objects;
create policy "storage_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('taller-archivos', 'trabajos-archivos'));

drop policy if exists "storage_authenticated_update" on storage.objects;
create policy "storage_authenticated_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('taller-archivos', 'trabajos-archivos'))
  with check (bucket_id in ('taller-archivos', 'trabajos-archivos'));

drop policy if exists "storage_authenticated_delete" on storage.objects;
create policy "storage_authenticated_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('taller-archivos', 'trabajos-archivos'));
