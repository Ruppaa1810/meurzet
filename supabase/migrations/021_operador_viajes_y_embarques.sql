-- 021_operador_viajes_y_embarques.sql
-- El operador crea y edita viajes y lugares de embarque; eliminar queda solo para el admin.
-- (Crear viajes ya funcionaba por la función crear_viaje_con_asientos; faltaba poder editarlos.)

DROP POLICY IF EXISTS "viajes_update_admin" ON viajes;
DROP POLICY IF EXISTS "viajes_update_staff" ON viajes;
CREATE POLICY "viajes_update_staff" ON viajes
  FOR UPDATE TO authenticated
  USING (mi_rol() IN ('admin_mayorista', 'operador_admin'))
  WITH CHECK (mi_rol() IN ('admin_mayorista', 'operador_admin'));

DROP POLICY IF EXISTS "lugares_embarque_delete" ON lugares_embarque;
CREATE POLICY "lugares_embarque_delete" ON lugares_embarque
  FOR DELETE TO authenticated
  USING (mi_rol() = 'admin_mayorista');
