-- 023_funciones_por_rol.sql
-- Las funciones de abajo no revisaban quién las llamaba y se podían usar incluso sin estar logueado
-- (por ejemplo, aprobar una reserva sin pagar). Los cuerpos son los que estaban en producción;
-- solo se agrega el control de rol al principio.

CREATE OR REPLACE FUNCTION public.requerir_rol(VARIADIC p_roles user_role[])
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF mi_rol() IS NULL OR NOT (mi_rol() = ANY (p_roles)) THEN
    RAISE EXCEPTION 'No tenés permiso para esta acción' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Aprobar / rechazar reservas: admin y operador
CREATE OR REPLACE FUNCTION public.aprobar_reserva(p_reserva_id integer, p_asiento_viaje_id integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM requerir_rol('admin_mayorista', 'operador_admin');
  UPDATE reservas SET estado = 'aprobado', motivo_rechazo = NULL WHERE id = p_reserva_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
  UPDATE mapa_asientos_viaje SET estado = 'confirmado', vendedor_bloqueo_id = NULL, bloqueado_hasta = NULL
  WHERE id = p_asiento_viaje_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asiento no encontrado'; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_reserva(p_reserva_id integer, p_asiento_viaje_id integer, p_motivo text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM requerir_rol('admin_mayorista', 'operador_admin');
  UPDATE reservas SET estado = 'rechazado', motivo_rechazo = p_motivo WHERE id = p_reserva_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
  UPDATE mapa_asientos_viaje SET estado = 'libre', vendedor_bloqueo_id = NULL, bloqueado_hasta = NULL
  WHERE id = p_asiento_viaje_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asiento no encontrado'; END IF;
  RETURN true;
END;
$$;

-- Viajes: admin y operador
CREATE OR REPLACE FUNCTION public.crear_viaje_con_asientos(p_origen text, p_destino text, p_fecha_salida timestamp with time zone, p_fecha_llegada timestamp with time zone, p_precio_base numeric, p_activo boolean DEFAULT true, p_unidad_id integer DEFAULT NULL::integer)
RETURNS viajes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_viaje viajes;
  v_seats JSONB;
  v_seat JSONB;
BEGIN
  PERFORM requerir_rol('admin_mayorista', 'operador_admin');
  INSERT INTO viajes (origen, destino, fecha_salida, fecha_llegada, precio_base, activo, unidad_id)
  VALUES (p_origen, p_destino, p_fecha_salida, p_fecha_llegada, p_precio_base, p_activo, p_unidad_id)
  RETURNING * INTO v_viaje;

  IF p_unidad_id IS NOT NULL THEN
    SELECT layout_config->'asientos' INTO v_seats FROM unidades WHERE id = p_unidad_id;
    IF v_seats IS NOT NULL AND jsonb_array_length(v_seats) > 0 THEN
      FOR v_seat IN SELECT * FROM jsonb_array_elements(v_seats) LOOP
        INSERT INTO mapa_asientos_viaje (viaje_id, nro_asiento, piso, categoria, estado)
        VALUES (v_viaje.id, (v_seat->>'nro')::int, (v_seat->>'piso')::int, (v_seat->>'categoria')::categoria_asiento, 'libre'::estado_asiento);
      END LOOP;
    END IF;
  END IF;

  RETURN v_viaje;
END;
$$;

-- Unidades: solo admin
CREATE OR REPLACE FUNCTION public.crear_unidad_con_asientos(p_patente text, p_asientos_piso_1 integer DEFAULT 0, p_categoria_piso_1 text DEFAULT 'semicama'::text, p_asientos_piso_2 integer DEFAULT 0, p_categoria_piso_2 text DEFAULT 'semicama'::text, p_empresa text DEFAULT ''::text)
RETURNS unidades LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unidad unidades;
  v_pisos INTEGER := 1;
  v_total INTEGER := p_asientos_piso_1;
  v_asientos JSONB := '[]'::jsonb;
  v_nro INTEGER := 1;
  v_i INTEGER;
BEGIN
  PERFORM requerir_rol('admin_mayorista');
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
  VALUES (p_patente, v_pisos, v_total, jsonb_build_object('empresa', p_empresa, 'asientos', v_asientos))
  RETURNING * INTO v_unidad;

  RETURN v_unidad;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_asientos_unidad(p_unidad_id integer, p_asientos jsonb)
RETURNS unidades LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unidad unidades;
BEGIN
  PERFORM requerir_rol('admin_mayorista');
  UPDATE unidades SET layout_config = layout_config || jsonb_build_object('asientos', p_asientos)
  WHERE id = p_unidad_id
  RETURNING * INTO v_unidad;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidad no encontrada'; END IF;

  UPDATE mapa_asientos_viaje m
  SET categoria = (s.value->>'categoria')::categoria_asiento
  FROM jsonb_array_elements(p_asientos) AS s
  WHERE m.viaje_id IN (SELECT id FROM viajes WHERE unidad_id = p_unidad_id)
    AND m.nro_asiento = (s.value->>'nro')::int;

  RETURN v_unidad;
END;
$$;

-- Liberar asiento: solo quien lo bloqueó, o admin/operador
CREATE OR REPLACE FUNCTION public.liberar_asiento(p_viaje_id integer, p_nro_asiento integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE mapa_asientos_viaje SET estado = 'libre', vendedor_bloqueo_id = NULL, bloqueado_hasta = NULL
  WHERE viaje_id = p_viaje_id AND nro_asiento = p_nro_asiento AND estado = 'bloqueado'
    AND (vendedor_bloqueo_id = auth.uid() OR mi_rol() IN ('admin_mayorista', 'operador_admin'));
  IF NOT FOUND THEN RAISE EXCEPTION 'El asiento no esta bloqueado'; END IF;
  RETURN true;
END;
$$;

-- Sin login no se llama a ninguna
REVOKE EXECUTE ON FUNCTION public.aprobar_reserva(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rechazar_reserva(integer, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crear_viaje_con_asientos(text, text, timestamptz, timestamptz, numeric, boolean, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crear_unidad_con_asientos(text, integer, text, integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.actualizar_asientos_unidad(integer, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.liberar_asiento(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bloquear_asiento(integer, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.informar_pago_cuotas(bigint[], text) FROM PUBLIC, anon;

-- Funciones viejas que la app ya no usa: nadie las puede llamar desde afuera
REVOKE EXECUTE ON FUNCTION public.crear_usuario_vendedor(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aprobar_pago(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rechazar_pago(integer) FROM PUBLIC, anon, authenticated;
