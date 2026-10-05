-- 019_unidad_con_viajes.sql
-- Una unidad que tiene viajes no se puede borrar (antes los viajes quedaban "Sin asignar").
ALTER TABLE viajes DROP CONSTRAINT IF EXISTS viajes_unidad_id_fkey;
ALTER TABLE viajes ADD CONSTRAINT viajes_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE RESTRICT;
