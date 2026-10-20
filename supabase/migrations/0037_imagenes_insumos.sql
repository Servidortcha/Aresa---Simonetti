-- ============================================================
-- 0037_imagenes_insumos.sql
-- Imagen identificatoria por insumo (se ve en miniatura en el
-- stock y en los desplegables). Columnas en la tabla insumos +
-- bucket público "imagenes-insumos".
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

alter table public.insumos
  add column if not exists imagen_url text,
  add column if not exists imagen_actualizado timestamptz;

insert into storage.buckets (id, name, public)
values ('imagenes-insumos', 'imagenes-insumos', true)
on conflict (id) do update set public = true;

drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read" on storage.objects
  for select
  using (bucket_id in ('taller-archivos', 'trabajos-archivos', 'partes-diarios', 'imagenes-insumos'));

drop policy if exists "storage_authenticated_insert" on storage.objects;
create policy "storage_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('taller-archivos', 'trabajos-archivos', 'partes-diarios', 'imagenes-insumos'));

drop policy if exists "storage_authenticated_update" on storage.objects;
create policy "storage_authenticated_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('taller-archivos', 'trabajos-archivos', 'partes-diarios', 'imagenes-insumos'))
  with check (bucket_id in ('taller-archivos', 'trabajos-archivos', 'partes-diarios', 'imagenes-insumos'));
