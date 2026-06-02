CREATE OR REPLACE FUNCTION bloquear_asiento(
  p_viaje_id INTEGER,
  p_nro_asiento INTEGER,
  p_vendedor_id TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE mapa_asientos_viaje
  SET estado = 'bloqueado',
      vendedor_bloqueo_id = p_vendedor_id,
      bloqueado_hasta = NOW() + INTERVAL '24 hours'
  WHERE viaje_id = p_viaje_id
    AND nro_asiento = p_nro_asiento
    AND estado = 'libre';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El asiento ya no está disponible';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION liberar_asiento(
  p_viaje_id INTEGER,
  p_nro_asiento INTEGER
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE mapa_asientos_viaje
  SET estado = 'libre',
      vendedor_bloqueo_id = NULL,
      bloqueado_hasta = NULL
  WHERE viaje_id = p_viaje_id
    AND nro_asiento = p_nro_asiento
    AND estado = 'bloqueado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El asiento no está bloqueado';
  END IF;
END;
$$;
