-- 015_embarques_multiples.sql
-- Un viaje puede tener N lugares de embarque (reemplaza lugar_embarque_id y lugar_embarque_2_id)

ALTER TABLE viajes
ADD COLUMN IF NOT EXISTS lugares_embarque_ids BIGINT[] NOT NULL DEFAULT '{}';

-- Migrar los dos embarques existentes, en orden y sin nulos ni duplicados
UPDATE viajes
SET lugares_embarque_ids = array_remove(ARRAY[lugar_embarque_id, NULLIF(lugar_embarque_2_id, lugar_embarque_id)], NULL)
WHERE lugar_embarque_id IS NOT NULL OR lugar_embarque_2_id IS NOT NULL;

DROP INDEX IF EXISTS idx_viajes_lugar_embarque;
DROP INDEX IF EXISTS idx_viajes_lugar_embarque_2;
ALTER TABLE viajes DROP COLUMN IF EXISTS lugar_embarque_id;
ALTER TABLE viajes DROP COLUMN IF EXISTS lugar_embarque_2_id;
