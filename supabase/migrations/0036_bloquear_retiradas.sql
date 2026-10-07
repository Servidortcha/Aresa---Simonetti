-- ============================================================
-- 0036_bloquear_retiradas.sql
-- Una OC marcada como retirada no se puede modificar ni
-- eliminar (ni desde la app ni por API directa).
-- ============================================================

create or replace function public.bloquear_oc_retirada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if OLD.estado = 'retirada' then
    raise exception 'La orden ya fue retirada y no se puede modificar ni eliminar.';
  end if;
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_bloquear_oc_retirada on public.ordenes_compra;
create trigger trg_bloquear_oc_retirada before update or delete on public.ordenes_compra
  for each row execute function public.bloquear_oc_retirada();
