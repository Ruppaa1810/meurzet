-- Ejecutar en el SQL Editor del dashboard de Supabase
-- https://supabase.com/dashboard/project/yenkuvvumgmuyvjludeg/sql/new

ALTER TABLE reservas 
ADD COLUMN IF NOT EXISTS estado_financiero text DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS monto_pagado numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS pagos_movimientos (
  id BIGSERIAL PRIMARY KEY,
  reserva_id bigint NOT NULL REFERENCES reservas(id),
  monto numeric NOT NULL,
  metodo_pago text NOT NULL,
  referencia text,
  estado_pago text NOT NULL DEFAULT 'pendiente',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pagos_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert para autenticados" ON pagos_movimientos;
DROP POLICY IF EXISTS "Select para autenticados" ON pagos_movimientos;

CREATE POLICY "Insert para autenticados" ON pagos_movimientos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Select para autenticados" ON pagos_movimientos
  FOR SELECT TO authenticated USING (true);

UPDATE reservas SET estado_financiero = 'pendiente' WHERE estado_financiero IS NULL;
