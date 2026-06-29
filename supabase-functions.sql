-- =============================================================================
-- BLOQUEAR / LIBERAR ASIENTOS
-- =============================================================================

CREATE OR REPLACE FUNCTION bloquear_asiento(
  p_viaje_id INTEGER,
  p_nro_asiento INTEGER,
  p_vendedor_id UUID
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  UPDATE mapa_asientos_viaje
  SET estado = 'bloqueado',
      vendedor_bloqueo_id = p_vendedor_id,
      bloqueado_hasta = NOW() + INTERVAL '24 hours'
  WHERE viaje_id = p_viaje_id
    AND nro_asiento = p_nro_asiento
    AND estado = 'libre';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El asiento ya no est� disponible';
  END IF;
  RETURN true;
END;
$func$;

CREATE OR REPLACE FUNCTION liberar_asiento(
  p_viaje_id INTEGER,
  p_nro_asiento INTEGER
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  UPDATE mapa_asientos_viaje
  SET estado = 'libre',
      vendedor_bloqueo_id = NULL,
      bloqueado_hasta = NULL
  WHERE viaje_id = p_viaje_id
    AND nro_asiento = p_nro_asiento
    AND estado = 'bloqueado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asiento no encontrado';
  END IF;

  RETURN true;
END;
$func$;

-- =============================================================================
-- APROBAR / RECHAZAR RESERVAS (SECURITY DEFINER para bypass RLS)
-- =============================================================================

CREATE OR REPLACE FUNCTION aprobar_reserva(
  p_reserva_id INTEGER,
  p_asiento_viaje_id INTEGER
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  UPDATE reservas
  SET estado = 'aprobado', motivo_rechazo = NULL
  WHERE id = p_reserva_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  UPDATE mapa_asientos_viaje
  SET estado = 'confirmado',
      vendedor_bloqueo_id = NULL,
      bloqueado_hasta = NULL
  WHERE id = p_asiento_viaje_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asiento no encontrado';
  END IF;

  RETURN true;
END;
$func$;

-- =============================================================================
-- CREAR UNIDAD CON ASIENTOS (SECURITY DEFINER para bypass RLS en layout_config)
-- =============================================================================

DROP FUNCTION IF EXISTS crear_unidad_con_asientos(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS crear_unidad_con_asientos(TEXT, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION crear_unidad_con_asientos(
  p_patente TEXT,
  p_asientos_piso_1 INTEGER DEFAULT 0,
  p_categoria_piso_1 TEXT DEFAULT 'semicama',
  p_asientos_piso_2 INTEGER DEFAULT 0,
  p_categoria_piso_2 TEXT DEFAULT 'semicama',
  p_empresa TEXT DEFAULT ''
) RETURNS unidades
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_unidad unidades;
  v_pisos INTEGER;
  v_total INTEGER;
  v_asientos JSONB := '[]'::jsonb;
  v_nro INTEGER := 1;
  v_i INTEGER;
BEGIN
  v_pisos := 1;
  v_total := p_asientos_piso_1;
  IF p_asientos_piso_2 > 0 THEN
    v_pisos := 2;
    v_total := v_total + p_asientos_piso_2;
  END IF;

  FOR v_i IN 1..p_asientos_piso_1 LOOP
    v_asientos := v_asientos || jsonb_build_object('nro', v_nro, 'piso', 1, 'categoria', p_categoria_piso_1);
    v_nro := v_nro + 1;
  END LOOP;

  FOR v_i IN 1..p_asientos_piso_2 LOOP
    v_asientos := v_asientos || jsonb_build_object('nro', v_nro, 'piso', 2, 'categoria', p_categoria_piso_2);
    v_nro := v_nro + 1;
  END LOOP;

  INSERT INTO unidades (patente, pisos, asientos_totales, layout_config)
  VALUES (
    p_patente,
    v_pisos,
    v_total,
    jsonb_build_object('empresa', p_empresa, 'asientos', v_asientos)
  )
  RETURNING * INTO v_unidad;

  RETURN v_unidad;
END;
$func$;

-- =============================================================================
-- ACTUALIZAR CONFIGURACION DE ASIENTOS DE UNA UNIDAD EXISTENTE
-- =============================================================================

CREATE OR REPLACE FUNCTION actualizar_asientos_unidad(
  p_unidad_id INTEGER,
  p_asientos JSONB
) RETURNS unidades
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_unidad unidades;
BEGIN
  UPDATE unidades
  SET layout_config = layout_config || jsonb_build_object('asientos', p_asientos)
  WHERE id = p_unidad_id
  RETURNING * INTO v_unidad;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unidad no encontrada';
  END IF;

  UPDATE mapa_asientos_viaje m
  SET categoria = (s.value->>'categoria')::categoria_asiento
  FROM jsonb_array_elements(p_asientos) AS s
  WHERE m.viaje_id IN (SELECT id FROM viajes WHERE unidad_id = p_unidad_id)
    AND m.nro_asiento = (s.value->>'nro')::int;

  RETURN v_unidad;
END;
$func$;

-- =============================================================================
-- CREAR VIAJE CON ASIENTOS (SECURITY DEFINER para bypass RLS en viajes)
-- =============================================================================

CREATE OR REPLACE FUNCTION crear_viaje_con_asientos(
  p_origen TEXT,
  p_destino TEXT,
  p_fecha_salida TIMESTAMPTZ,
  p_fecha_llegada TIMESTAMPTZ,
  p_precio_base NUMERIC,
  p_activo BOOLEAN DEFAULT true,
  p_unidad_id INTEGER DEFAULT NULL
) RETURNS viajes
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_viaje viajes;
  v_seats JSONB;
  v_seat JSONB;
BEGIN
  INSERT INTO viajes (origen, destino, fecha_salida, fecha_llegada, precio_base, activo, unidad_id)
  VALUES (p_origen, p_destino, p_fecha_salida, p_fecha_llegada, p_precio_base, p_activo, p_unidad_id)
  RETURNING * INTO v_viaje;

  IF p_unidad_id IS NOT NULL THEN
    SELECT layout_config->'asientos' INTO v_seats FROM unidades WHERE id = p_unidad_id;

    IF v_seats IS NOT NULL AND jsonb_array_length(v_seats) > 0 THEN
      FOR v_seat IN SELECT * FROM jsonb_array_elements(v_seats)
      LOOP
        INSERT INTO mapa_asientos_viaje (viaje_id, nro_asiento, piso, categoria, estado)
        VALUES (
          v_viaje.id,
          (v_seat->>'nro')::int,
          (v_seat->>'piso')::int,
          (v_seat->>'categoria')::categoria_asiento,
          'libre'::estado_asiento
        );
      END LOOP;
    END IF;
  END IF;

  RETURN v_viaje;
END;
$func$;

CREATE OR REPLACE FUNCTION rechazar_reserva(
  p_reserva_id INTEGER,
  p_asiento_viaje_id INTEGER,
  p_motivo TEXT
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  UPDATE reservas
  SET estado = 'rechazado', motivo_rechazo = p_motivo
  WHERE id = p_reserva_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  UPDATE mapa_asientos_viaje
  SET estado = 'libre',
      vendedor_bloqueo_id = NULL,
      bloqueado_hasta = NULL
  WHERE id = p_asiento_viaje_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asiento no encontrado';
  END IF;

  RETURN true;
END;
$func$;
