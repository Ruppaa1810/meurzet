-- 017_motivo_rechazo_cuotas.sql
-- Cuando el admin rechaza el comprobante de una cuota, el vendedor ve el motivo hasta que sube uno nuevo.

ALTER TABLE pagos_movimientos ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

CREATE OR REPLACE FUNCTION informar_pago_cuotas(p_pago_ids BIGINT[], p_comprobante_url TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE pagos_movimientos p
  SET comprobante_url = p_comprobante_url,
      motivo_rechazo = NULL
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
