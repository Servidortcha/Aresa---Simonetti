-- ============================================================
-- 0042_horas_quincenales.sql
-- Registro de horas por quincena que cada encargado entrega a
-- su jefe. La quincena son dos semanas seguidas: se guarda
-- "desde" y "hasta", sin depender del calendario (1-15 / 16-30).
--
-- Tabla:
--   horas_quincenales: una carga por período y frente, con el
--   detalle de personas y horas guardado en jsonb:
--   [{ "nombre": "Pérez, Juan", "horas": 48 }]
--
-- Acceso:
--   - Encargados cargan y editan lo de su frente.
--   - admin / subadmin ven y editan todo.
--   - supervisión solo lee los frentes asignados.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

create table if not exists public.horas_quincenales (
  id uuid primary key default gen_random_uuid(),
  frente_id uuid references public.frentes_trabajo(id) on delete set null,
  desde date not null,
  hasta date not null,
  fecha_entrega date,
  detalle jsonb not null default '[]'::jsonb,
  total_horas numeric(10,2) not null default 0,
  observaciones text,
  archivo jsonb,
  usuario_email text,
  created_at timestamptz not null default now(),
  constraint horas_quincenales_periodo_check check (hasta >= desde)
);

create index if not exists horas_quincenales_desde_idx on public.horas_quincenales (desde desc);
create index if not exists horas_quincenales_frente_idx on public.horas_quincenales (frente_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.horas_quincenales enable row level security;

drop policy if exists "horas_quincenales_select" on public.horas_quincenales;
create policy "horas_quincenales_select" on public.horas_quincenales
  for select to authenticated
  using (
    public.es_gestion()
    or public.es_encargado_del_frente(frente_id)
    or (public.es_supervision() and public.es_supervision_del_frente(frente_id))
  );

drop policy if exists "horas_quincenales_insert" on public.horas_quincenales;
create policy "horas_quincenales_insert" on public.horas_quincenales
  for insert to authenticated
  with check (
    public.es_gestion() or public.es_encargado_del_frente(frente_id)
  );

drop policy if exists "horas_quincenales_update" on public.horas_quincenales;
create policy "horas_quincenales_update" on public.horas_quincenales
  for update to authenticated
  using (public.es_gestion() or public.es_encargado_del_frente(frente_id))
  with check (public.es_gestion() or public.es_encargado_del_frente(frente_id));

drop policy if exists "horas_quincenales_delete" on public.horas_quincenales;
create policy "horas_quincenales_delete" on public.horas_quincenales
  for delete to authenticated
  using (public.es_gestion() or public.es_encargado_del_frente(frente_id));

-- ------------------------------------------------------------
-- Storage: foto o PDF de la planilla de horas
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('horas-quincenales', 'horas-quincenales', true)
on conflict (id) do update set public = true;

drop policy if exists "horas_quincenales_storage_read" on storage.objects;
create policy "horas_quincenales_storage_read" on storage.objects
  for select to public
  using (bucket_id = 'horas-quincenales');

drop policy if exists "horas_quincenales_storage_insert" on storage.objects;
create policy "horas_quincenales_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'horas-quincenales');

drop policy if exists "horas_quincenales_storage_update" on storage.objects;
create policy "horas_quincenales_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'horas-quincenales')
  with check (bucket_id = 'horas-quincenales');

drop policy if exists "horas_quincenales_storage_delete" on storage.objects;
create policy "horas_quincenales_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'horas-quincenales');
