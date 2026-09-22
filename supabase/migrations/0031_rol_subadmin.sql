-- ============================================================
-- 0031_rol_subadmin.sql
-- Rol "subadmin": puede operar todo como el admin EXCEPTO
-- RRHH (empleados, conceptos, liquidaciones) y gestión de
-- usuarios/accesos (perfiles, supervision_frentes y sus RPCs).
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

-- 0) Permitir el rol en la tabla perfiles
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('admin', 'subadmin', 'taller_stock', 'encargado', 'operario', 'grua', 'supervision'));

-- 1) Helper: admin o subadmin
create or replace function public.es_gestion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol in ('admin', 'subadmin')
  );
$$;

-- Trabajos: alta/edición también para subadmin
create or replace function public.es_admin_o_taller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol in ('admin', 'taller_stock', 'subadmin')
  );
$$;

-- 2) Políticas operativas: admin_all -> gestion
drop policy if exists "insumos_admin_write" on public.insumos;
create policy "insumos_admin_write" on public.insumos
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "movimientos_admin_write" on public.movimientos;
create policy "movimientos_admin_write" on public.movimientos
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "trabajos_admin_delete" on public.trabajos;
create policy "trabajos_admin_delete" on public.trabajos
  for delete to authenticated
  using (public.es_gestion());

drop policy if exists "taller_trabajos_admin_write" on public.taller_trabajos;
create policy "taller_trabajos_admin_write" on public.taller_trabajos
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "frentes_trabajo_admin_all" on public.frentes_trabajo;
create policy "frentes_trabajo_admin_all" on public.frentes_trabajo
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "frente_personas_admin_all" on public.frente_personas;
create policy "frente_personas_admin_all" on public.frente_personas
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "taller_trabajo_insumos_admin_all" on public.taller_trabajo_insumos;
create policy "taller_trabajo_insumos_admin_all" on public.taller_trabajo_insumos
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "fabricaciones_admin_all" on public.fabricaciones;
create policy "fabricaciones_admin_all" on public.fabricaciones
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "fabricacion_insumos_admin_all" on public.fabricacion_insumos;
create policy "fabricacion_insumos_admin_all" on public.fabricacion_insumos
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "fabricacion_estimados_admin_all" on public.fabricacion_estimados;
create policy "fabricacion_estimados_admin_all" on public.fabricacion_estimados
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "taller_trabajo_items_admin_write" on public.taller_trabajo_items;
create policy "taller_trabajo_items_admin_write" on public.taller_trabajo_items
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "precios_materiales_admin_all" on public.precios_materiales;
create policy "precios_materiales_admin_all" on public.precios_materiales
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "cotizaciones_admin_all" on public.cotizaciones;
create policy "cotizaciones_admin_all" on public.cotizaciones
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "fabricacion_articulos_externos_admin_all" on public.fabricacion_articulos_externos;
create policy "fabricacion_articulos_externos_admin_all" on public.fabricacion_articulos_externos
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

drop policy if exists "caja_herramientas_admin_write" on public.caja_herramientas;
create policy "caja_herramientas_admin_write" on public.caja_herramientas
  for all to authenticated
  using (public.es_gestion())
  with check (public.es_gestion());

-- Partes diarios: escritura para gestión o encargado de su frente
drop policy if exists "partes_diarios_insert" on public.partes_diarios;
create policy "partes_diarios_insert" on public.partes_diarios
  for insert to authenticated
  with check (public.es_gestion() or public.es_encargado_del_frente(frente_id));

drop policy if exists "partes_diarios_update" on public.partes_diarios;
create policy "partes_diarios_update" on public.partes_diarios
  for update to authenticated
  using (public.es_gestion() or public.es_encargado_del_frente(frente_id))
  with check (public.es_gestion() or public.es_encargado_del_frente(frente_id));

drop policy if exists "partes_diarios_delete" on public.partes_diarios;
create policy "partes_diarios_delete" on public.partes_diarios
  for delete to authenticated
  using (public.es_gestion() or public.es_encargado_del_frente(frente_id));

-- Lecturas: gestión ve todo
drop policy if exists "partes_diarios_select" on public.partes_diarios;
create policy "partes_diarios_select" on public.partes_diarios
  for select to authenticated
  using (
    public.es_gestion()
    or public.es_encargado_del_frente(frente_id)
    or (public.es_supervision() and public.es_supervision_del_frente(frente_id))
  );

drop policy if exists "frente_personas_select_encargado" on public.frente_personas;
create policy "frente_personas_select_encargado" on public.frente_personas
  for select to authenticated
  using (
    public.es_gestion()
    or public.es_encargado_del_frente(frente_id)
    or (public.es_supervision() and public.es_supervision_del_frente(frente_id))
  );

drop policy if exists "caja_control_log_insert_admin_encargado" on public.caja_control_log;
create policy "caja_control_log_insert_admin_encargado" on public.caja_control_log
  for insert to authenticated
  with check (public.es_gestion() or exists (select 1 from public.perfiles where id = auth.uid() and rol = 'encargado'));

-- 3) RPCs operativos: permitir subadmin
create or replace function public.registrar_movimiento_insumo(
  p_insumo_id bigint,
  p_tipo text,
  p_cantidad numeric,
  p_producto_texto text default null,
  p_nota text default null,
  p_usuario_email text default null,
  p_fabricacion_id bigint default null
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
  v_estado text;
  v_obra text;
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

  -- Solo administración puede registrar entradas de stock
  if p_tipo = 'entrada' and v_rol not in ('admin', 'subadmin') then
    return query select false, 'Solo el administrador puede registrar entradas.', null::numeric;
    return;
  end if;

  -- Las entradas no pueden vincularse a una fabricación
  if p_tipo = 'entrada' and p_fabricacion_id is not null then
    return query select false, 'Las entradas no se pueden vincular a una fabricación.', null::numeric;
    return;
  end if;

  -- Si viene vinculada a una fabricación: debe existir y estar abierta
  if p_fabricacion_id is not null then
    select estado, nombre into v_estado, v_obra
    from public.fabricaciones
    where id = p_fabricacion_id;

    if not found then
      return query select false, 'La fabricación no existe.', null::numeric;
      return;
    end if;

    if v_estado <> 'abierta' then
      return query select false, 'La fabricación ya está cerrada. No se pueden agregar más insumos.', null::numeric;
      return;
    end if;

    if p_producto_texto is null then
      p_producto_texto := v_obra;
    end if;
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

  -- Registra el consumo dentro de la fabricación abierta
  if p_fabricacion_id is not null then
    insert into public.fabricacion_insumos (fabricacion_id, insumo_id, cantidad, usuario_email)
    values (p_fabricacion_id, p_insumo_id, p_cantidad, p_usuario_email);
  end if;

  return query select true, 'Movimiento registrado.', v_nuevo;
end;
$$;

revoke all on function public.registrar_movimiento_insumo(bigint, text, numeric, text, text, text, bigint) from public;
grant execute on function public.registrar_movimiento_insumo(bigint, text, numeric, text, text, text, bigint) to authenticated;

create or replace function public.cerrar_fabricacion(p_fabricacion_id bigint)
returns table (ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();

  if v_rol is null or v_rol not in ('admin', 'subadmin') then
    return query select false, 'Solo administración puede cerrar fabricaciones.';
    return;
  end if;

  update public.fabricaciones
  set estado = 'cerrada', fecha_cierre = now()
  where id = p_fabricacion_id and estado = 'abierta';

  if found then
    return query select true, 'Fabricación cerrada.';
  else
    return query select false, 'La fabricación no existe o ya está cerrada.';
  end if;
end;
$$;

revoke all on function public.cerrar_fabricacion(bigint) from public;
grant execute on function public.cerrar_fabricacion(bigint) to authenticated;

create or replace function public.actualizar_insumo_fabricacion(
  p_fabricacion_id bigint,
  p_fila_id bigint default null,
  p_insumo_id bigint default null,
  p_cantidad numeric default null,
  p_usuario_email text default null
)
returns table (ok boolean, mensaje text, nuevo_stock numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_stock numeric;
  v_nuevo numeric;
  v_insumo bigint;
  v_actual numeric;
  v_obra text;
  v_delta numeric;
  v_tipo text;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();

  if v_rol is null or v_rol not in ('admin', 'subadmin') then
    return query select false, 'Solo administración puede modificar insumos.', null::numeric;
    return;
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    return query select false, 'La cantidad tiene que ser un número mayor a 0.', null::numeric;
    return;
  end if;

  select nombre into v_obra from public.fabricaciones where id = p_fabricacion_id;
  if not found then
    return query select false, 'La fabricación no existe.', null::numeric;
    return;
  end if;

  -- Determinar el insumo y la cantidad actual
  if p_fila_id is null then
    if p_insumo_id is null then
      return query select false, 'Falta elegir el insumo.', null::numeric;
      return;
    end if;
    v_insumo := p_insumo_id;
    v_actual := 0;
  else
    select insumo_id, cantidad into v_insumo, v_actual
    from public.fabricacion_insumos
    where id = p_fila_id and fabricacion_id = p_fabricacion_id;

    if not found then
      return query select false, 'El insumo no pertenece a esta fabricación.', null::numeric;
      return;
    end if;
  end if;

  -- Bloquea la fila del insumo para evitar condiciones de carrera
  select stock into v_stock from public.insumos where id = v_insumo for update;
  if not found then
    return query select false, 'El insumo no existe.', null::numeric;
    return;
  end if;

  v_delta := p_cantidad - v_actual;

  if v_delta > 0 then
    if v_delta > v_stock then
      return query select false, format('No hay suficiente stock para la diferencia (%s).', v_delta), null::numeric;
      return;
    end if;
    v_nuevo := v_stock - v_delta;
    v_tipo := 'salida';
  elsif v_delta < 0 then
    v_nuevo := v_stock + abs(v_delta);
    v_tipo := 'entrada';
  else
    v_nuevo := v_stock;
  end if;

  if v_delta <> 0 then
    insert into public.movimientos (insumo_id, tipo, cantidad, producto_texto, nota, usuario_email, stock_resultante)
    values (v_insumo, v_tipo, abs(v_delta), v_obra, 'Corrección fabricación', p_usuario_email, v_nuevo);

    update public.insumos set stock = v_nuevo where id = v_insumo;
  end if;

  if p_fila_id is null then
    insert into public.fabricacion_insumos (fabricacion_id, insumo_id, cantidad, usuario_email)
    values (p_fabricacion_id, v_insumo, p_cantidad, p_usuario_email);
  else
    update public.fabricacion_insumos set cantidad = p_cantidad where id = p_fila_id;
  end if;

  return query select true, 'Insumo actualizado.', v_nuevo;
end;
$$;

revoke all on function public.actualizar_insumo_fabricacion(bigint, bigint, bigint, numeric, text) from public;
grant execute on function public.actualizar_insumo_fabricacion(bigint, bigint, bigint, numeric, text) to authenticated;

create or replace function public.eliminar_insumo_fabricacion(
  p_fila_id bigint,
  p_usuario_email text default null
)
returns table (ok boolean, mensaje text, nuevo_stock numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_insumo bigint;
  v_cantidad numeric;
  v_obra text;
  v_stock numeric;
  v_nuevo numeric;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();

  if v_rol is null or v_rol not in ('admin', 'subadmin') then
    return query select false, 'Solo administración puede quitar insumos.', null::numeric;
    return;
  end if;

  select fi.insumo_id, fi.cantidad, f.nombre
  into v_insumo, v_cantidad, v_obra
  from public.fabricacion_insumos fi
  join public.fabricaciones f on f.id = fi.fabricacion_id
  where fi.id = p_fila_id;

  if not found then
    return query select false, 'El insumo no existe.', null::numeric;
    return;
  end if;

  select stock into v_stock from public.insumos where id = v_insumo for update;
  if not found then
    return query select false, 'El insumo no existe.', null::numeric;
    return;
  end if;

  v_nuevo := v_stock + v_cantidad;

  insert into public.movimientos (insumo_id, tipo, cantidad, producto_texto, nota, usuario_email, stock_resultante)
  values (v_insumo, 'entrada', v_cantidad, v_obra, 'Insumo quitado de fabricación', p_usuario_email, v_nuevo);

  update public.insumos set stock = v_nuevo where id = v_insumo;

  delete from public.fabricacion_insumos where id = p_fila_id;

  return query select true, 'Insumo quitado y stock devuelto.', v_nuevo;
end;
$$;

revoke all on function public.eliminar_insumo_fabricacion(bigint, text) from public;
grant execute on function public.eliminar_insumo_fabricacion(bigint, text) to authenticated;

create or replace function public.eliminar_fabricacion(
  p_fabricacion_id bigint,
  p_usuario_email text default null
)
returns table (ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_obra text;
  v_row record;
  v_stock numeric;
  v_nuevo numeric;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();

  if v_rol is null or v_rol not in ('admin', 'subadmin') then
    return query select false, 'Solo administración puede eliminar fabricaciones.';
    return;
  end if;

  select nombre into v_obra from public.fabricaciones where id = p_fabricacion_id;
  if not found then
    return query select false, 'La fabricación no existe.';
    return;
  end if;

  for v_row in
    select insumo_id, cantidad from public.fabricacion_insumos where fabricacion_id = p_fabricacion_id
  loop
    select stock into v_stock from public.insumos where id = v_row.insumo_id for update;
    if found then
      v_nuevo := v_stock + v_row.cantidad;
      update public.insumos set stock = v_nuevo where id = v_row.insumo_id;

      insert into public.movimientos (insumo_id, tipo, cantidad, producto_texto, nota, usuario_email, stock_resultante)
      values (v_row.insumo_id, 'entrada', v_row.cantidad, v_obra, 'Baja de obra', p_usuario_email, v_nuevo);
    end if;
  end loop;

  delete from public.fabricaciones where id = p_fabricacion_id;

  return query select true, 'Obra eliminada y stock devuelto.';
end;
$$;

revoke all on function public.eliminar_fabricacion(bigint, text) from public;
grant execute on function public.eliminar_fabricacion(bigint, text) to authenticated;

create or replace function public.ajustar_stock_insumo(
  p_insumo_id bigint,
  p_stock_nuevo numeric,
  p_motivo text default null,
  p_usuario_email text default null
)
returns table (ok boolean, mensaje text, nuevo_stock numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_stock numeric;
  v_unidad text;
  v_nombre text;
  v_delta numeric;
  v_nuevo numeric;
begin
  select rol into v_rol from public.perfiles where id = auth.uid();

  if v_rol is null or v_rol not in ('admin', 'subadmin') then
    return query select false, 'Solo administración puede ajustar el stock.', null::numeric;
    return;
  end if;

  if p_stock_nuevo is null or p_stock_nuevo < 0 then
    return query select false, 'El stock tiene que ser un número mayor o igual a 0.', null::numeric;
    return;
  end if;

  select stock, unidad, nombre into v_stock, v_unidad, v_nombre
  from public.insumos
  where id = p_insumo_id
  for update;

  if not found then
    return query select false, 'El insumo no existe.', null::numeric;
    return;
  end if;

  v_delta := p_stock_nuevo - v_stock;

  if v_delta = 0 then
    return query select true, 'El stock no cambió.', p_stock_nuevo;
    return;
  end if;

  v_nuevo := p_stock_nuevo;

  insert into public.movimientos (insumo_id, tipo, cantidad, producto_texto, nota, usuario_email, stock_resultante)
  values (p_insumo_id, 'ajuste', v_delta, null, coalesce(p_motivo, 'Ajuste manual de stock'), p_usuario_email, v_nuevo);

  update public.insumos
  set stock = v_nuevo
  where id = p_insumo_id;

  return query select true, 'Stock ajustado.', v_nuevo;
end;
$$;

revoke all on function public.ajustar_stock_insumo(bigint, numeric, text, text) from public;
grant execute on function public.ajustar_stock_insumo(bigint, numeric, text, text) to authenticated;

-- asignar_rol: agregar 'subadmin' a los roles válidos
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

  if p_rol not in ('admin', 'subadmin', 'taller_stock', 'encargado', 'operario', 'grua', 'supervision') then
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
