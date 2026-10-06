-- 024_operador_valida_sus_vendedores.sql
-- El operador valida solo los pagos de los vendedores que dio de alta él; el admin, los de todos.

CREATE OR REPLACE FUNCTION public.puede_gestionar_vendedor(p_vendedor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mi_rol() = 'admin_mayorista'
      OR (mi_rol() = 'operador_admin'
          AND EXISTS (SELECT 1 FROM perfiles WHERE id = p_vendedor_id AND created_by = auth.uid()));
$$;

DROP POLICY IF EXISTS "Update solo admin/operador" ON pagos_movimientos;
CREATE POLICY "Update solo admin/operador" ON pagos_movimientos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM reservas r WHERE r.id = reserva_id AND puede_gestionar_vendedor(r.vendedor_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM reservas r WHERE r.id = reserva_id AND puede_gestionar_vendedor(r.vendedor_id)));

DROP POLICY IF EXISTS "reservas_update_admin" ON reservas;
CREATE POLICY "reservas_update_admin" ON reservas
  FOR UPDATE TO authenticated
  USING (puede_gestionar_vendedor(vendedor_id))
  WITH CHECK (puede_gestionar_vendedor(vendedor_id));

CREATE OR REPLACE FUNCTION public.aprobar_reserva(p_reserva_id integer, p_asiento_viaje_id integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM requerir_rol('admin_mayorista', 'operador_admin');
  IF NOT puede_gestionar_vendedor((SELECT vendedor_id FROM reservas WHERE id = p_reserva_id)) THEN
    RAISE EXCEPTION 'No tenés permiso para esta acción' USING ERRCODE = '42501';
  END IF;
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
  IF NOT puede_gestionar_vendedor((SELECT vendedor_id FROM reservas WHERE id = p_reserva_id)) THEN
    RAISE EXCEPTION 'No tenés permiso para esta acción' USING ERRCODE = '42501';
  END IF;
  UPDATE reservas SET estado = 'rechazado', motivo_rechazo = p_motivo WHERE id = p_reserva_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva no encontrada'; END IF;
  UPDATE mapa_asientos_viaje SET estado = 'libre', vendedor_bloqueo_id = NULL, bloqueado_hasta = NULL
  WHERE id = p_asiento_viaje_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asiento no encontrado'; END IF;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.puede_gestionar_vendedor(uuid) FROM PUBLIC, anon;
