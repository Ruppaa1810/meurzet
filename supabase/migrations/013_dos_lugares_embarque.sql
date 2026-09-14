-- 013_dos_lugares_embarque.sql
-- Agregar segundo lugar de embarque a viajes

ALTER TABLE viajes
ADD COLUMN IF NOT EXISTS lugar_embarque_2_id BIGINT REFERENCES lugares_embarque(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_viajes_lugar_embarque_2 ON viajes(lugar_embarque_2_id);
