-- 012_lugares_embarque.sql
-- Lugares de embarque para viajes

-- ============================================================
-- TABLA: lugares_embarque
-- ============================================================
CREATE TABLE IF NOT EXISTS lugares_embarque (
  id          BIGSERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  direccion   TEXT,
  ciudad      TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lugares_embarque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lugares_embarque_select" ON lugares_embarque;
DROP POLICY IF EXISTS "lugares_embarque_insert" ON lugares_embarque;
DROP POLICY IF EXISTS "lugares_embarque_update" ON lugares_embarque;
DROP POLICY IF EXISTS "lugares_embarque_delete" ON lugares_embarque;

CREATE POLICY "lugares_embarque_select" ON lugares_embarque
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lugares_embarque_insert" ON lugares_embarque
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin_mayorista', 'operador_admin')
  );

CREATE POLICY "lugares_embarque_update" ON lugares_embarque
  FOR UPDATE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin_mayorista', 'operador_admin')
  );

CREATE POLICY "lugares_embarque_delete" ON lugares_embarque
  FOR DELETE TO authenticated USING (
    (SELECT rol FROM perfiles WHERE id = auth.uid()) IN ('admin_mayorista', 'operador_admin')
  );

-- ============================================================
-- AGREGAR lugar_embarque_id a viajes
-- ============================================================
ALTER TABLE viajes
ADD COLUMN IF NOT EXISTS lugar_embarque_id BIGINT REFERENCES lugares_embarque(id) ON DELETE SET NULL;

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lugares_embarque_ciudad ON lugares_embarque(ciudad);
CREATE INDEX IF NOT EXISTS idx_viajes_lugar_embarque ON viajes(lugar_embarque_id);
