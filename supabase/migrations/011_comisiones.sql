-- 011_comisiones.sql
-- Sistema de comisiones para vendedores
-- comisiones_config: configuración por vendedor (% de comisión)
-- comisiones: registros individuales por pago confirmado

-- ============================================================
-- TABLA: comisiones_config
-- ============================================================
CREATE TABLE IF NOT EXISTS comisiones_config (
  id            SERIAL PRIMARY KEY,
  vendedor_id   UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  porcentaje    NUMERIC(5,2) NOT NULL DEFAULT 0,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id)
);

ALTER TABLE comisiones_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comisiones_config_select" ON comisiones_config;
DROP POLICY IF EXISTS "comisiones_config_insert" ON comisiones_config;
DROP POLICY IF EXISTS "comisiones_config_update" ON comisiones_config;
DROP POLICY IF EXISTS "comisiones_config_delete" ON comisiones_config;

CREATE POLICY "comisiones_config_select" ON comisiones_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comisiones_config_insert" ON comisiones_config
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin_mayorista', 'operador_admin')
  );

CREATE POLICY "comisiones_config_update" ON comisiones_config
  FOR UPDATE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin_mayorista', 'operador_admin')
  );

CREATE POLICY "comisiones_config_delete" ON comisiones_config
  FOR DELETE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

-- ============================================================
-- TABLA: comisiones
-- ============================================================
CREATE TABLE IF NOT EXISTS comisiones (
  id              BIGSERIAL PRIMARY KEY,
  reserva_id      BIGINT NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  pago_id         BIGINT NOT NULL REFERENCES pagos_movimientos(id) ON DELETE CASCADE,
  vendedor_id     UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  monto_base      NUMERIC NOT NULL,
  porcentaje      NUMERIC(5,2) NOT NULL,
  monto_comision  NUMERIC NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente',
  pagado_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pago_id)
);

ALTER TABLE comisiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comisiones_select" ON comisiones;
DROP POLICY IF EXISTS "comisiones_insert" ON comisiones;
DROP POLICY IF EXISTS "comisiones_update" ON comisiones;
DROP POLICY IF EXISTS "comisiones_delete" ON comisiones;

CREATE POLICY "comisiones_select" ON comisiones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comisiones_insert" ON comisiones
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin_mayorista', 'operador_admin')
  );

CREATE POLICY "comisiones_update" ON comisiones
  FOR UPDATE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin_mayorista', 'operador_admin')
  );

CREATE POLICY "comisiones_delete" ON comisiones
  FOR DELETE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_comisiones_vendedor ON comisiones(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_estado ON comisiones(estado);
CREATE INDEX IF NOT EXISTS idx_comisiones_config_vendedor ON comisiones_config(vendedor_id);
