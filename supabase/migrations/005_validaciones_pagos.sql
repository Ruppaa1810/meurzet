-- 005_validaciones_pagos.sql
-- Política UPDATE para que admin pueda cambiar estado_pago en validaciones

DROP POLICY IF EXISTS "Update para autenticados" ON pagos_movimientos;

CREATE POLICY "Update para autenticados" ON pagos_movimientos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
