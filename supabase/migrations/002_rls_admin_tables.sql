-- 002_rls_admin_tables.sql
-- Policies para tablas que el admin gestiona desde el frontend

-- UNIDADES
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unidades_select_autenticados" ON unidades;
DROP POLICY IF EXISTS "unidades_insert_admin" ON unidades;
DROP POLICY IF EXISTS "unidades_update_admin" ON unidades;
DROP POLICY IF EXISTS "unidades_delete_admin" ON unidades;

CREATE POLICY "unidades_select_autenticados" ON unidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "unidades_insert_admin" ON unidades
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

CREATE POLICY "unidades_update_admin" ON unidades
  FOR UPDATE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

CREATE POLICY "unidades_delete_admin" ON unidades
  FOR DELETE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

-- VIAJES
ALTER TABLE viajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "viajes_select_autenticados" ON viajes;
DROP POLICY IF EXISTS "viajes_insert_admin" ON viajes;
DROP POLICY IF EXISTS "viajes_update_admin" ON viajes;
DROP POLICY IF EXISTS "viajes_delete_admin" ON viajes;

CREATE POLICY "viajes_select_autenticados" ON viajes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "viajes_insert_admin" ON viajes
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

CREATE POLICY "viajes_update_admin" ON viajes
  FOR UPDATE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

CREATE POLICY "viajes_delete_admin" ON viajes
  FOR DELETE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

-- MAPA_ASIENTOS_VIAJE (lectura todos, escritura solo admin)
ALTER TABLE mapa_asientos_viaje ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asientos_select_autenticados" ON mapa_asientos_viaje;
DROP POLICY IF EXISTS "asientos_insert_admin" ON mapa_asientos_viaje;
DROP POLICY IF EXISTS "asientos_update_admin" ON mapa_asientos_viaje;
DROP POLICY IF EXISTS "asientos_delete_admin" ON mapa_asientos_viaje;

CREATE POLICY "asientos_select_autenticados" ON mapa_asientos_viaje
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "asientos_insert_admin" ON mapa_asientos_viaje
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

CREATE POLICY "asientos_update_admin" ON mapa_asientos_viaje
  FOR UPDATE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

CREATE POLICY "asientos_delete_admin" ON mapa_asientos_viaje
  FOR DELETE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );
