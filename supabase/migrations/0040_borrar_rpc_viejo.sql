-- ============================================================
-- 0040_borrar_rpc_viejo.sql
-- Quita la versión antigua de registrar_movimiento_insumo
-- (6 parámetros) que quedó en la base y generaba el error de
-- "could not choose the best candidate function". Queda solo la
-- versión de 7 parámetros (con p_fabricacion_id).
-- ============================================================

drop function if exists public.registrar_movimiento_insumo(bigint, text, numeric, text, text, text);
