-- ============================================================
-- 0018_ajustes_stock.sql
-- Registra los ajustes de stock que hace el administrador al
-- editar un insumo (Stock y Stock Pañol) en el historial de
-- movimientos, con un tipo nuevo "ajuste".
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

-- 1) Permitir el tipo 'ajuste' en la columna tipo de movimientos.
--    Se quita cualquier check existente sobre tipo y se crea uno
--    que acepte entrada, salida y ajuste.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname
    from pg_constraint
    where conrelid = 'public.movimientos'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table public.movimientos drop constraint %I', v_name);
  end loop;
end $$;

alter table public.movimientos
  add constraint movimientos_tipo_check check (tipo in ('entrada', 'salida', 'ajuste'));

-- 2) RPC: ajustar el stock de un insumo (solo admin) registrando
--    un movimiento de tipo 'ajuste' con la diferencia aplicada.
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

  if v_rol is null or v_rol <> 'admin' then
    return query select false, 'Solo el administrador puede ajustar el stock.', null::numeric;
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
  values (p_insumo_id, 'ajuste', abs(v_delta), null, coalesce(p_motivo, 'Ajuste manual de stock'), p_usuario_email, v_nuevo);

  update public.insumos
  set stock = v_nuevo
  where id = p_insumo_id;

  return query select true, 'Stock ajustado.', v_nuevo;
end;
$$;

revoke all on function public.ajustar_stock_insumo(bigint, numeric, text, text) from public;
grant execute on function public.ajustar_stock_insumo(bigint, numeric, text, text) to authenticated;
