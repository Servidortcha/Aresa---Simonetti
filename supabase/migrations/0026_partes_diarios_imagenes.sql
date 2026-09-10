-- 0026_partes_diarios_imagenes.sql
-- Hace público el bucket partes-diarios para que las miniaturas
-- se vean correctamente y actualiza la política de lectura.
insert into storage.buckets (id, name, public)
values ('partes-diarios', 'partes-diarios', true)
on conflict (id) do update set public = true;

drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read" on storage.objects
  for select
  using (bucket_id in ('taller-archivos', 'trabajos-archivos', 'partes-diarios'));
