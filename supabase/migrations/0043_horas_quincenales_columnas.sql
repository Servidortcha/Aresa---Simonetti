-- ============================================================
-- 0043_horas_quincenales_columnas.sql
-- La planilla que se rinde al jefe tiene una columna por frente
-- (Casa Central, Bunge Tancacha, Frías, Pico, Villegas...) y las
-- horas vienen en formato H:MM. Adaptamos la tabla para guardar
-- esa estructura completa en una sola rendición.
--
-- Cambios:
--   * columnas: nombres de las columnas de horas, en orden.
--   * detalle: [{ "nombre": "...", "minutos": [710, 0, 6587] }]
--     con los minutos alineados al orden de "columnas".
--   * total_minutos: suma total de la rendición.
--   * usuario_id: dueño de la carga (para permisos).
--
-- Acceso:
--   - El dueño (encargado) ve y edita sus rendiciones.
--   - admin / subadmin ven y editan todo.
--   - supervisión ve todo, solo lectura.
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

alter table public.horas_quincenales
  add column if not exists columnas jsonb not null default '[]'::jsonb,
  add column if not exists total_minutos integer not null default 0,
  add column if not exists usuario_id uuid default auth.uid();

-- Completar el dueño de las cargas viejas a partir del email.
update public.horas_quincenales h
set usuario_id = u.id
from auth.users u
where h.usuario_id is null
  and u.email = h.usuario_email;

create index if not exists horas_quincenales_usuario_idx on public.horas_quincenales (usuario_id);

-- ------------------------------------------------------------
-- RLS por dueño
-- ------------------------------------------------------------
drop policy if exists "horas_quincenales_select" on public.horas_quincenales;
create policy "horas_quincenales_select" on public.horas_quincenales
  for select to authenticated
  using (
    public.es_gestion()
    or usuario_id = auth.uid()
    or public.es_supervision()
  );

drop policy if exists "horas_quincenales_insert" on public.horas_quincenales;
create policy "horas_quincenales_insert" on public.horas_quincenales
  for insert to authenticated
  with check (public.es_gestion() or usuario_id = auth.uid());

drop policy if exists "horas_quincenales_update" on public.horas_quincenales;
create policy "horas_quincenales_update" on public.horas_quincenales
  for update to authenticated
  using (public.es_gestion() or usuario_id = auth.uid())
  with check (public.es_gestion() or usuario_id = auth.uid());

drop policy if exists "horas_quincenales_delete" on public.horas_quincenales;
create policy "horas_quincenales_delete" on public.horas_quincenales
  for delete to authenticated
  using (public.es_gestion() or usuario_id = auth.uid());
