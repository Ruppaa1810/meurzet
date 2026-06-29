-- 003_config_pagos.sql
-- Configuracion centralizada de opciones de cuotas/recargo

CREATE TABLE IF NOT EXISTS config_pagos (
  id        SERIAL PRIMARY KEY,
  cuotas    INTEGER NOT NULL,
  recargo   NUMERIC(5,2) NOT NULL DEFAULT 0,
  activo    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Datos iniciales por defecto
INSERT INTO config_pagos (cuotas, recargo) VALUES
  (1, 0),
  (3, 5),
  (6, 10),
  (12, 20);

-- RLS
ALTER TABLE config_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_pagos_select" ON config_pagos;
DROP POLICY IF EXISTS "config_pagos_insert" ON config_pagos;
DROP POLICY IF EXISTS "config_pagos_update" ON config_pagos;
DROP POLICY IF EXISTS "config_pagos_delete" ON config_pagos;

CREATE POLICY "config_pagos_select" ON config_pagos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "config_pagos_insert" ON config_pagos
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

CREATE POLICY "config_pagos_update" ON config_pagos
  FOR UPDATE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );

CREATE POLICY "config_pagos_delete" ON config_pagos
  FOR DELETE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) = 'admin_mayorista'
  );
