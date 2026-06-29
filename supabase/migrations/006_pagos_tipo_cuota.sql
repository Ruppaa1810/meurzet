-- 006_pagos_tipo_cuota.sql
-- Agrega tipo de pago (seña/cuota) y numeración de cuotas a pagos_movimientos

ALTER TABLE pagos_movimientos
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'seña',
ADD COLUMN IF NOT EXISTS cuota_numero integer,
ADD COLUMN IF NOT EXISTS cuotas_totales integer;
