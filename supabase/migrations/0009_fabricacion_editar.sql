-- ============================================================
-- 0009_fabricacion_editar.sql
-- Modificar/eliminar insumos y obras de Fabricación con ajuste
-- automático del stock y registro en movimientos.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Actualizar o agregar un insumo a una fabricación.
--    Ajusta el stock según la diferencia.
-- ------------------------------------------------------------
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

  if v_rol is null or v_rol <> 'admin' then
    return query select false, 'Solo el administrador puede modificar insumos.', null::numeric;
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

-- ------------------------------------------------------------
-- 2) Quitar un insumo de una fabricación: devuelve el stock.
-- ------------------------------------------------------------
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

  if v_rol is null or v_rol <> 'admin' then
    return query select false, 'Solo el administrador puede quitar insumos.', null::numeric;
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

-- ------------------------------------------------------------
-- 3) Eliminar una fabricación completa: devuelve el stock de
--    todos sus insumos y borra las filas (cascade).
-- ------------------------------------------------------------
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

  if v_rol is null or v_rol <> 'admin' then
    return query select false, 'Solo el administrador puede eliminar fabricaciones.';
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
