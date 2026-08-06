-- ============================================================
-- 0002_organigrama.sql
-- Organigrama — Simonetti Montajes Industriales
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

-- Frentes de trabajo (escuadrillas externas)
create table if not exists public.frentes_trabajo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.frente_personas (
  id uuid primary key default gen_random_uuid(),
  frente_id uuid not null references public.frentes_trabajo(id) on delete cascade,
  nombre text not null,
  rol text not null default 'Operario',
  created_at timestamptz not null default now()
);

create index if not exists frente_personas_frente_id_idx on public.frente_personas (frente_id);

-- RLS: datos de la empresa → solo admin
alter table public.frentes_trabajo enable row level security;
alter table public.frente_personas enable row level security;

drop policy if exists "frentes_trabajo_admin_all" on public.frentes_trabajo;
create policy "frentes_trabajo_admin_all" on public.frentes_trabajo
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "frente_personas_admin_all" on public.frente_personas;
create policy "frente_personas_admin_all" on public.frente_personas
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Datos iniciales (solo si no existen)
insert into public.frentes_trabajo (nombre)
select 'Bunge Tancacha'
where not exists (select 1 from public.frentes_trabajo where nombre = 'Bunge Tancacha');

insert into public.frente_personas (frente_id, nombre, rol)
select id, 'Andrés Mosto', 'Puntero'
from public.frentes_trabajo
where nombre = 'Bunge Tancacha'
  and not exists (select 1 from public.frente_personas where nombre = 'Andrés Mosto');

insert into public.frentes_trabajo (nombre)
select 'Acopios Bunge'
where not exists (select 1 from public.frentes_trabajo where nombre = 'Acopios Bunge');

insert into public.frente_personas (frente_id, nombre, rol)
select id, 'Franco Grasselli', 'Encargado de escuadrilla'
from public.frentes_trabajo
where nombre = 'Acopios Bunge'
  and not exists (select 1 from public.frente_personas where nombre = 'Franco Grasselli');

insert into public.frentes_trabajo (nombre)
select 'Manfredi'
where not exists (select 1 from public.frentes_trabajo where nombre = 'Manfredi');

insert into public.frente_personas (frente_id, nombre, rol)
select id, 'Darío Godoy', 'Encargado de escuadrilla'
from public.frentes_trabajo
where nombre = 'Manfredi'
  and not exists (select 1 from public.frente_personas where nombre = 'Darío Godoy');
