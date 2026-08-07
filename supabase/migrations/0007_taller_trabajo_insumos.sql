-- ============================================================
-- 0007_taller_trabajo_insumos.sql
-- Insumos del stock usados en cada trabajo de Taller.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

create table if not exists public.taller_trabajo_insumos (
  id uuid primary key default gen_random_uuid(),
  trabajo_id uuid not null references public.taller_trabajos(id) on delete cascade,
  insumo_id bigint not null references public.insumos(id),
  cantidad numeric not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists taller_trabajo_insumos_trabajo_id_idx on public.taller_trabajo_insumos (trabajo_id);

alter table public.taller_trabajo_insumos enable row level security;

drop policy if exists "taller_trabajo_insumos_admin_all" on public.taller_trabajo_insumos;
create policy "taller_trabajo_insumos_admin_all" on public.taller_trabajo_insumos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());
