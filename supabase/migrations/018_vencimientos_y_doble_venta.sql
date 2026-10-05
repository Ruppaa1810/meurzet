-- 018_vencimientos_y_doble_venta.sql
-- 1) Vencimiento automático de reservas sin comprobante (24 hs) y de asientos bloqueados sin reserva
-- 2) Viajes ya salidos dejan de estar activos
-- 3) Un asiento no puede tener dos reservas activas (había ventas dobles)
-- 4) Auditoría: relación con perfiles para poder mostrar el vendedor
-- 5) El precio de venta queda guardado en cada reserva

-- ============================================================
-- Bloqueo al elegir asientos: 2 hs alcanzan para cargar la reserva.
-- Una vez creada la reserva, el asiento queda tomado por la reserva, no por este plazo.
-- ============================================================
CREATE OR REPLACE FUNCTION bloquear_asiento(p_viaje_id INTEGER, p_nro_asiento INTEGER, p_vendedor_id UUID)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  UPDATE mapa_asientos_viaje
  SET estado = 'bloqueado', vendedor_bloqueo_id = p_vendedor_id, bloqueado_hasta = now() + interval '2 hours'
  WHERE viaje_id = p_viaje_id AND nro_asiento = p_nro_asiento AND estado = 'libre';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El asiento ya no está disponible';
  END IF;
  RETURN true;
END;
$func$;

-- ============================================================
-- Tarea periódica
-- ============================================================
CREATE OR REPLACE FUNCTION vencer_reservas_y_bloqueos()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
BEGIN
  -- Reservas cuyo comprobante de seña no se subió en 24 hs
  WITH vencidas AS (
    UPDATE reservas
    SET estado = 'rechazado',
        motivo_rechazo = 'Vencida: no se subió el comprobante de la seña dentro de las 24 hs'
    WHERE estado = 'pendiente_comprobante' AND created_at < now() - interval '24 hours'
    RETURNING id, asiento_viaje_id
  ), pagos AS (
    UPDATE pagos_movimientos SET estado_pago = 'rechazado'
    WHERE estado_pago = 'pendiente' AND reserva_id IN (SELECT id FROM vencidas)
  )
  UPDATE mapa_asientos_viaje m
  SET estado = 'libre', vendedor_bloqueo_id = NULL, bloqueado_hasta = NULL
  WHERE m.id IN (SELECT asiento_viaje_id FROM vencidas)
    AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.asiento_viaje_id = m.id AND r.estado <> 'rechazado'
                    AND r.id NOT IN (SELECT id FROM vencidas));

  -- Asientos que se eligieron y nunca se reservaron
  UPDATE mapa_asientos_viaje m
  SET estado = 'libre', vendedor_bloqueo_id = NULL, bloqueado_hasta = NULL
  WHERE m.estado = 'bloqueado'
    AND (m.bloqueado_hasta IS NULL OR m.bloqueado_hasta < now())
    AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.asiento_viaje_id = m.id AND r.estado <> 'rechazado');

  -- Viajes que ya salieron
  UPDATE viajes SET activo = false WHERE activo AND fecha_salida < now();
END;
$func$;

REVOKE EXECUTE ON FUNCTION vencer_reservas_y_bloqueos() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('vencer-reservas') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vencer-reservas');
SELECT cron.schedule('vencer-reservas', '*/10 * * * *', 'SELECT public.vencer_reservas_y_bloqueos()');

-- Primera pasada ahora
SELECT vencer_reservas_y_bloqueos();

-- ============================================================
-- Doble venta: un asiento, una sola reserva activa
-- ============================================================
-- Único caso que la pasada anterior no resuelve: dos reservas de prueba en validación (viaje de mayo ya salido)
UPDATE reservas SET estado = 'rechazado', motivo_rechazo = 'Asiento duplicado: ya tenía otra reserva activa'
WHERE id = 120 AND asiento_viaje_id = 660 AND estado = 'pendiente_validacion';

CREATE UNIQUE INDEX IF NOT EXISTS reservas_un_asiento_activo
  ON reservas (asiento_viaje_id) WHERE estado <> 'rechazado' AND asiento_viaje_id IS NOT NULL;

-- ============================================================
-- Auditoría: relación con perfiles (sin esto la pantalla daba error 400)
-- ============================================================
ALTER TABLE auditoria_pasajes DROP CONSTRAINT IF EXISTS auditoria_pasajes_vendedor_id_fkey;
ALTER TABLE auditoria_pasajes
  ADD CONSTRAINT auditoria_pasajes_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES perfiles(id) ON DELETE SET NULL;

-- ============================================================
-- Precio de venta guardado en la reserva (antes se usaba el precio actual del viaje)
-- ============================================================
UPDATE reservas r
SET pasajero_datos = r.pasajero_datos || jsonb_build_object('precio_unitario', v.precio_base)
FROM viajes v
WHERE v.id = r.viaje_id AND NOT (r.pasajero_datos ? 'precio_unitario');

NOTIFY pgrst, 'reload schema';
