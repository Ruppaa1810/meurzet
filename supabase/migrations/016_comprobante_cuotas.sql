-- 016_comprobante_cuotas.sql
-- Las cuotas se pagan igual que la seña: el vendedor sube el comprobante y el admin lo valida.

ALTER TABLE pagos_movimientos ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- El vendedor no puede modificar pagos (RLS 010): solo adjunta el comprobante a cuotas pendientes de sus reservas
CREATE OR REPLACE FUNCTION informar_pago_cuotas(p_pago_ids BIGINT[], p_comprobante_url TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE pagos_movimientos p
  SET comprobante_url = p_comprobante_url
  FROM reservas r
  WHERE p.id = ANY(p_pago_ids)
    AND r.id = p.reserva_id
    AND r.vendedor_id = auth.uid()
    AND p.tipo = 'cuota'
    AND p.estado_pago = 'pendiente';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay cuotas pendientes para informar';
  END IF;
  RETURN v_count;
END;
$func$;

REVOKE EXECUTE ON FUNCTION informar_pago_cuotas(BIGINT[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION informar_pago_cuotas(BIGINT[], TEXT) TO authenticated;

-- Fix de datos: la cuota única de saldo se creaba con monto 0
UPDATE pagos_movimientos p
SET monto = v.precio_base - ROUND(v.precio_base * (r.pasajero_datos->>'porcentaje_pago')::NUMERIC / 100)
FROM reservas r
JOIN viajes v ON v.id = r.viaje_id
WHERE r.id = p.reserva_id
  AND p.tipo = 'cuota'
  AND p.monto = 0
  AND p.estado_pago = 'pendiente'
  AND COALESCE(p.cuotas_totales, 1) = 1
  AND (r.pasajero_datos->>'porcentaje_pago')::NUMERIC < 100;
