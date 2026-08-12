-- ============================================================
-- 0017_numeracion.sql
-- Numeración secuencial única para los registros del módulo
-- Trabajos (corte láser / tornería) y del módulo Taller.
-- El número se asigna automáticamente al crear cada registro y
-- nunca se reutiliza (aunque se elimine un registro).
-- También sale en la tarjeta impresa de ambos módulos.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

-- 1) Secuencias
create sequence if not exists public.trabajos_numero_seq;
create sequence if not exists public.taller_trabajos_numero_seq;

-- 2) Columnas numero
alter table public.trabajos add column if not exists numero bigint;
alter table public.taller_trabajos add column if not exists numero bigint;

-- 3) Numerar los registros existentes y ajustar las secuencias
do $$
declare
  v_max bigint;
begin
  with x as (
    select id, row_number() over (order by id) as rn from public.trabajos
  )
  update public.trabajos t set numero = x.rn from x where t.id = x.id;

  select coalesce(max(numero), 0) into v_max from public.trabajos;
  perform setval('public.trabajos_numero_seq', v_max);

  with x as (
    select id, row_number() over (order by id) as rn from public.taller_trabajos
  )
  update public.taller_trabajos t set numero = x.rn from x where t.id = x.id;

  select coalesce(max(numero), 0) into v_max from public.taller_trabajos;
  perform setval('public.taller_trabajos_numero_seq', v_max);
end $$;

-- 4) Trigger: asigna el próximo número al insertar
create or replace function public.asignar_numero_trabajos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.numero is null then
    NEW.numero := nextval('public.trabajos_numero_seq');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_trabajos_numero on public.trabajos;
create trigger trg_trabajos_numero before insert on public.trabajos
  for each row execute function public.asignar_numero_trabajos();

create or replace function public.asignar_numero_taller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.numero is null then
    NEW.numero := nextval('public.taller_trabajos_numero_seq');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_taller_trabajos_numero on public.taller_trabajos;
create trigger trg_taller_trabajos_numero before insert on public.taller_trabajos
  for each row execute function public.asignar_numero_taller();

-- 5) Índices de unicidad
create unique index if not exists trabajos_numero_uniq_idx on public.trabajos (numero);
create unique index if not exists taller_trabajos_numero_uniq_idx on public.taller_trabajos (numero);
