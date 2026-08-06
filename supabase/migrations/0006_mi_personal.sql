-- ============================================================
-- 0006_mi_personal.sql
-- Función RPC: devuelve el personal de los frentes del usuario
-- logueado. Se usa en el parte diario para que el encargado
-- siempre vea a la gente que el admin le asignó (aunque la
-- política RLS de frente_personas no esté aplicada).
--
-- Cómo aplicarlo: abrí Supabase → SQL Editor, pegá este archivo
-- completo y ejecutalo.
-- ============================================================

create or replace function public.mi_personal()
returns table (id uuid, frente_id uuid, nombre text, rol text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.frente_id, p.nombre, p.rol
  from public.frente_personas p
  join public.frentes_trabajo f on f.id = p.frente_id
  where f.encargado_user_id = auth.uid()
  order by p.created_at;
$$;
