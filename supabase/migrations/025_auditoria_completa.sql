-- 025_auditoria_completa.sql
-- Auditoría de quién hace qué: la escriben triggers en la base, así queda registrado aunque la acción
-- venga de cualquier pantalla. El usuario es el de la sesión (auth.uid()); en las acciones que hacen las
-- funciones del servidor (crear usuarios) se toma de quien la pidió.
-- Si registrar falla nunca se corta la acción original (una venta o un login no pueden fallar por la auditoría).

CREATE TABLE IF NOT EXISTS public.auditoria (
  id bigserial PRIMARY KEY,
  fecha timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  categoria text NOT NULL,   -- ventas | pagos | viajes | usuarios | configuracion | sesiones
  detalle text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria (usuario_id);

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
-- Solo el admin la lee; nadie la escribe desde la app (solo los triggers y las funciones del servidor)
DROP POLICY IF EXISTS auditoria_select_admin ON public.auditoria;
CREATE POLICY auditoria_select_admin ON public.auditoria FOR SELECT TO authenticated
  USING (public.mi_rol() = 'admin_mayorista');

CREATE OR REPLACE FUNCTION public.registrar_auditoria(p_categoria text, p_detalle text, p_usuario uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO auditoria (usuario_id, categoria, detalle)
  VALUES (COALESCE(p_usuario, auth.uid()), p_categoria, p_detalle);
EXCEPTION WHEN others THEN
  NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_auditoria(text, text, uuid) FROM PUBLIC, anon, authenticated;

-- Una venta de varios pasajeros son varias reservas con el mismo grupo_id: se registra una sola vez,
-- con el código que ve el cliente (el de la primera reserva del grupo).
CREATE OR REPLACE FUNCTION public.primera_reserva_grupo(p_reserva_id bigint)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT min(r2.id) FROM reservas r, reservas r2
      WHERE r.id = p_reserva_id AND r.pasajero_datos->>'grupo_id' IS NOT NULL
        AND r2.pasajero_datos->>'grupo_id' = r.pasajero_datos->>'grupo_id'),
    p_reserva_id);
$$;

CREATE OR REPLACE FUNCTION public.texto_venta(p_reserva_id bigint, p_con_cantidad boolean DEFAULT true)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'MEU-' || lpad(public.primera_reserva_grupo(p_reserva_id)::text, 6, '0')
    || COALESCE(' · ' || v.origen || ' → ' || v.destino, '')
    || CASE WHEN NOT p_con_cantidad THEN '' ELSE ' · ' || (SELECT count(*) FROM reservas r2 WHERE public.primera_reserva_grupo(r2.id) = public.primera_reserva_grupo(p_reserva_id)
                   AND r2.viaje_id IS NOT DISTINCT FROM r.viaje_id) || ' pasajero(s)' END
  FROM reservas r LEFT JOIN viajes v ON v.id = r.viaje_id
  WHERE r.id = p_reserva_id;
$$;

CREATE OR REPLACE FUNCTION public.plata(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '$ ' || replace(to_char(round(n), 'FM999G999G999G990'), ',', '.');
$$;

-- RESERVAS: venta, comprobante de seña, aprobación y rechazo
CREATE OR REPLACE FUNCTION public.auditar_reservas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  primera boolean := NEW.id = public.primera_reserva_grupo(NEW.id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF primera THEN
      PERFORM public.registrar_auditoria('ventas', 'Registró la venta ' || public.texto_venta(NEW.id, false)
        || ' · cliente ' || coalesce(NEW.pasajero_datos->>'nombre', '') || ' ' || coalesce(NEW.pasajero_datos->>'apellido', ''));
    END IF;
  ELSIF primera THEN
    IF NEW.comprobante_url IS NOT NULL AND OLD.comprobante_url IS DISTINCT FROM NEW.comprobante_url THEN
      PERFORM public.registrar_auditoria('pagos', 'Subió el comprobante de la seña de ' || public.texto_venta(NEW.id));
    END IF;
    IF NEW.estado = 'aprobado' AND OLD.estado <> 'aprobado' THEN
      PERFORM public.registrar_auditoria('pagos', 'Aprobó la seña de ' || public.texto_venta(NEW.id));
    ELSIF NEW.estado = 'rechazado' AND OLD.estado <> 'rechazado' THEN
      PERFORM public.registrar_auditoria('ventas', CASE WHEN auth.uid() IS NULL THEN 'Venció la reserva ' ELSE 'Rechazó la venta ' END
        || public.texto_venta(NEW.id) || coalesce(' · motivo: ' || NEW.motivo_rechazo, ''));
    END IF;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_reservas ON public.reservas;
CREATE TRIGGER trg_auditar_reservas AFTER INSERT OR UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_reservas();

-- CUOTAS: comprobante informado, aprobado o rechazado (la seña se registra en reservas)
CREATE OR REPLACE FUNCTION public.auditar_pagos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cuota text;
  monto numeric;
BEGIN
  IF NEW.tipo <> 'cuota' OR NEW.reserva_id <> public.primera_reserva_grupo(NEW.reserva_id) THEN
    RETURN NULL;
  END IF;
  SELECT sum(pm.monto) INTO monto FROM pagos_movimientos pm
   WHERE public.primera_reserva_grupo(pm.reserva_id) = NEW.reserva_id
     AND pm.tipo = 'cuota' AND pm.cuota_numero IS NOT DISTINCT FROM NEW.cuota_numero;
  cuota := 'la cuota ' || coalesce(NEW.cuota_numero::text, '') || '/' || coalesce(NEW.cuotas_totales::text, '')
    || ' (' || public.plata(monto) || ') de ' || public.texto_venta(NEW.reserva_id);

  IF NEW.estado_pago = 'confirmado' AND OLD.estado_pago <> 'confirmado' THEN
    PERFORM public.registrar_auditoria('pagos', 'Aprobó ' || cuota);
  ELSIF NEW.comprobante_url IS NOT NULL AND OLD.comprobante_url IS DISTINCT FROM NEW.comprobante_url THEN
    PERFORM public.registrar_auditoria('pagos', 'Informó el pago de ' || cuota);
  ELSIF NEW.comprobante_url IS NULL AND OLD.comprobante_url IS NOT NULL THEN
    PERFORM public.registrar_auditoria('pagos', 'Rechazó el comprobante de ' || cuota || coalesce(' · motivo: ' || NEW.motivo_rechazo, ''));
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_pagos ON public.pagos_movimientos;
CREATE TRIGGER trg_auditar_pagos AFTER UPDATE ON public.pagos_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_pagos();

-- VIAJES
CREATE OR REPLACE FUNCTION public.auditar_viajes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r viajes;
  t text;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  t := 'el viaje ' || r.origen || ' → ' || r.destino || ' del ' || to_char(r.fecha_salida AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_auditoria('viajes', 'Creó ' || t || ' · ' || public.plata(r.precio_base));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.registrar_auditoria('viajes', 'Eliminó ' || t);
  ELSIF auth.uid() IS NULL AND OLD.activo AND NOT NEW.activo THEN
    PERFORM public.registrar_auditoria('viajes', 'Se cerró la venta de ' || t || ' (ya salió)');
  ELSIF (OLD.origen, OLD.destino, OLD.fecha_salida, OLD.fecha_llegada, OLD.precio_base, OLD.activo, OLD.unidad_id, OLD.lugares_embarque_ids)
     IS DISTINCT FROM (NEW.origen, NEW.destino, NEW.fecha_salida, NEW.fecha_llegada, NEW.precio_base, NEW.activo, NEW.unidad_id, NEW.lugares_embarque_ids) THEN
    PERFORM public.registrar_auditoria('viajes', 'Editó ' || t
      || CASE WHEN OLD.precio_base <> NEW.precio_base THEN ' · precio ' || public.plata(OLD.precio_base) || ' → ' || public.plata(NEW.precio_base) ELSE '' END
      || CASE WHEN OLD.activo AND NOT NEW.activo THEN ' · lo desactivó' WHEN NOT OLD.activo AND NEW.activo THEN ' · lo activó' ELSE '' END);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_viajes ON public.viajes;
CREATE TRIGGER trg_auditar_viajes AFTER INSERT OR UPDATE OR DELETE ON public.viajes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_viajes();

-- FLOTA
CREATE OR REPLACE FUNCTION public.auditar_unidades() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.registrar_auditoria('viajes', 'Creó la unidad ' || NEW.patente || ' (' || NEW.asientos_totales || ' asientos)');
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.registrar_auditoria('viajes', 'Eliminó la unidad ' || OLD.patente);
  ELSIF OLD IS DISTINCT FROM NEW THEN
    PERFORM public.registrar_auditoria('viajes', 'Editó la unidad ' || NEW.patente
      || CASE WHEN OLD.layout_config IS DISTINCT FROM NEW.layout_config THEN ' (plano de asientos)' ELSE '' END);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_unidades ON public.unidades;
CREATE TRIGGER trg_auditar_unidades AFTER INSERT OR UPDATE OR DELETE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.auditar_unidades();

CREATE OR REPLACE FUNCTION public.auditar_lugares() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NULL; END IF;
  PERFORM public.registrar_auditoria('viajes',
    CASE TG_OP WHEN 'INSERT' THEN 'Creó' WHEN 'DELETE' THEN 'Eliminó' ELSE 'Editó' END || ' el lugar de embarque '
    || CASE WHEN TG_OP = 'DELETE' THEN OLD.nombre || ' (' || OLD.ciudad || ')' ELSE NEW.nombre || ' (' || NEW.ciudad || ')' END);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_lugares ON public.lugares_embarque;
CREATE TRIGGER trg_auditar_lugares AFTER INSERT OR UPDATE OR DELETE ON public.lugares_embarque
  FOR EACH ROW EXECUTE FUNCTION public.auditar_lugares();

-- USUARIOS (los crea la función del servidor: quien lo pidió queda en created_by)
CREATE OR REPLACE FUNCTION public.auditar_perfiles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  quien text := NEW.nombre || ' (' || coalesce(NEW.email, '') || ')';
  rol text := CASE NEW.rol WHEN 'admin_mayorista' THEN 'admin' WHEN 'operador_admin' THEN 'operador' ELSE 'vendedor' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NOT NULL THEN
      PERFORM public.registrar_auditoria('usuarios', 'Creó el usuario ' || quien || ' como ' || rol, NEW.created_by);
    END IF;
  ELSIF OLD.created_by IS NULL AND NEW.created_by IS NOT NULL THEN
    -- Alta por la función del servidor: el perfil lo crea el registro y después se completa
    PERFORM public.registrar_auditoria('usuarios', 'Creó el usuario ' || quien || ' como ' || rol, NEW.created_by);
  ELSE
    IF OLD.activo IS DISTINCT FROM NEW.activo THEN
      PERFORM public.registrar_auditoria('usuarios', CASE WHEN NEW.activo THEN 'Activó' ELSE 'Desactivó' END || ' al usuario ' || quien);
    END IF;
    IF OLD.rol <> NEW.rol THEN
      PERFORM public.registrar_auditoria('usuarios', 'Cambió el rol de ' || quien || ' a ' || rol);
    END IF;
    IF (OLD.nombre, OLD.agencia_nombre) IS DISTINCT FROM (NEW.nombre, NEW.agencia_nombre) THEN
      PERFORM public.registrar_auditoria('usuarios', 'Editó los datos de ' || quien);
    END IF;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_perfiles ON public.perfiles;
CREATE TRIGGER trg_auditar_perfiles AFTER INSERT OR UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.auditar_perfiles();

-- COMISIONES Y CONFIGURACIÓN
CREATE OR REPLACE FUNCTION public.auditar_comisiones_config() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.porcentaje, OLD.activo) IS NOT DISTINCT FROM (NEW.porcentaje, NEW.activo) THEN RETURN NULL; END IF;
  PERFORM public.registrar_auditoria('configuracion', 'Puso la comisión de '
    || (SELECT nombre || ' (' || coalesce(email, '') || ')' FROM perfiles WHERE id = NEW.vendedor_id)
    || ' en ' || NEW.porcentaje || '%' || CASE WHEN NEW.activo THEN '' ELSE ' (inactiva)' END);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_comisiones_config ON public.comisiones_config;
CREATE TRIGGER trg_auditar_comisiones_config AFTER INSERT OR UPDATE ON public.comisiones_config
  FOR EACH ROW EXECUTE FUNCTION public.auditar_comisiones_config();

CREATE OR REPLACE FUNCTION public.auditar_comisiones() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'pagado' AND OLD.estado IS DISTINCT FROM 'pagado' THEN
    PERFORM public.registrar_auditoria('pagos', 'Marcó como pagada la comisión de ' || public.plata(NEW.monto_comision) || ' a '
      || (SELECT nombre || ' (' || coalesce(email, '') || ')' FROM perfiles WHERE id = NEW.vendedor_id));
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_comisiones ON public.comisiones;
CREATE TRIGGER trg_auditar_comisiones AFTER UPDATE ON public.comisiones
  FOR EACH ROW EXECUTE FUNCTION public.auditar_comisiones();

CREATE OR REPLACE FUNCTION public.auditar_configuracion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.valor IS NOT DISTINCT FROM NEW.valor THEN RETURN NULL; END IF;
  PERFORM public.registrar_auditoria('configuracion', 'Cambió ' ||
    CASE NEW.clave WHEN 'banco' THEN 'los datos bancarios' WHEN 'contacto' THEN 'el contacto' ELSE NEW.clave END);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_configuracion ON public.configuracion_general;
CREATE TRIGGER trg_auditar_configuracion AFTER INSERT OR UPDATE ON public.configuracion_general
  FOR EACH ROW EXECUTE FUNCTION public.auditar_configuracion();

-- SESIONES: entradas, salidas y cambios de contraseña propios, desde el registro del login
CREATE OR REPLACE FUNCTION public.auditar_sesiones() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  texto text := CASE NEW.payload->>'action'
    WHEN 'login' THEN 'Inició sesión'
    WHEN 'logout' THEN 'Cerró sesión'
    WHEN 'user_updated_password' THEN 'Cambió su contraseña'
    WHEN 'user_recovery_requested' THEN 'Pidió recuperar su contraseña'
  END;
BEGIN
  IF texto IS NOT NULL THEN
    PERFORM public.registrar_auditoria('sesiones', texto, (NEW.payload->>'actor_id')::uuid);
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_sesiones ON auth.audit_log_entries;
CREATE TRIGGER trg_auditar_sesiones AFTER INSERT ON auth.audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.auditar_sesiones();
