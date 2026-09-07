-- 008_config_general.sql
-- Tabla de configuración general del sistema (teléfono, banco, etc.)
-- y campo porcentaje_minimo_seña en config_pagos

-- ============================================================
-- TABLA: configuracion_general
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion_general (
  clave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE configuracion_general ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_gen_select" ON configuracion_general;
DROP POLICY IF EXISTS "config_gen_upsert" ON configuracion_general;

CREATE POLICY "config_gen_select" ON configuracion_general
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "config_gen_upsert" ON configuracion_general
  FOR ALL TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  )
  WITH CHECK (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

-- Datos iniciales
INSERT INTO configuracion_general (clave, valor) VALUES
  ('contacto', '"11 2345-6789"'),
  ('banco', '{"alias": "MEURZET.PAGOS", "cbu": "1234567890123456789012", "titular": "Meurzet Viajes", "banco": "Meurzet S.A."}')
ON CONFLICT (clave) DO NOTHING;

-- ============================================================
-- AGREGAR porcentaje_minimo_seña a config_pagos
-- ============================================================
ALTER TABLE config_pagos
ADD COLUMN IF NOT EXISTS porcentaje_minimo_seia NUMERIC(5,2) DEFAULT 30;
