-- 010_rls_pagos_restrict.sql
-- Restringe UPDATE en pagos_movimientos a solo admin_mayorista y operador_admin

DROP POLICY IF EXISTS "Update para autenticados" ON pagos_movimientos;

CREATE POLICY "Update solo admin/operador" ON pagos_movimientos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
        AND perfiles.rol IN ('admin_mayorista', 'operador_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
        AND perfiles.rol IN ('admin_mayorista', 'operador_admin')
    )
  );
