-- Datos de prueba: un viaje "[PRUEBA]" con una reserva en cada etapa del flujo del vendedor.
-- Vendedor: Santiago (santiagorupani1810@gmail.com). Se borra todo con borrar_datos_prueba.sql.
--
-- Venta estándar: $100.000, seña 30% ($30.000) + 3 cuotas con 10% de recargo ($25.667 c/u) = $107.000.
-- Comisión del vendedor: 10% del total de la venta = $10.700.

BEGIN;

-- Vendedor de prueba con comisión del 10% (si ya tenía config, se respeta)
INSERT INTO comisiones_config (vendedor_id, porcentaje, activo)
VALUES ('2f21de06-b841-4047-ae13-346526d0d2a1', 10, true)
ON CONFLICT (vendedor_id) DO NOTHING;

CREATE TEMP TABLE prueba_ctx AS
SELECT (crear_viaje_con_asientos('Paraná', 'Mendoza [PRUEBA]', now() + interval '20 days', now() + interval '20 days 14 hours', 100000, true, 15)).id AS viaje_id,
       '2f21de06-b841-4047-ae13-346526d0d2a1'::uuid AS vendedor_id,
       'https://placehold.co/600x800/png?text=Comprobante+de+prueba' AS comprobante;

UPDATE viajes SET lugares_embarque_ids = '{3,1}' WHERE id = (SELECT viaje_id FROM prueba_ctx);

CREATE FUNCTION pg_temp.reserva(p_nro INT, p_nombre TEXT, p_apellido TEXT, p_dni TEXT, p_tel TEXT, p_estado estado_validacion,
                                p_grupo TEXT, p_cuotas INT, p_embarque INT, p_con_comprobante BOOLEAN, p_motivo TEXT, p_dias_atras INT,
                                p_responsable BOOLEAN DEFAULT true)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  c prueba_ctx;
  v_asiento INT;
  v_id INT;
BEGIN
  SELECT * INTO c FROM prueba_ctx;
  SELECT id INTO v_asiento FROM mapa_asientos_viaje WHERE viaje_id = c.viaje_id AND nro_asiento = p_nro;

  INSERT INTO reservas (viaje_id, vendedor_id, asiento_viaje_id, estado, tipo_pago, comprobante_url, motivo_rechazo, created_at, pasajero_datos)
  VALUES (c.viaje_id, c.vendedor_id, v_asiento, p_estado, 'parcial',
          CASE WHEN p_con_comprobante THEN c.comprobante END, p_motivo, now() - make_interval(days => p_dias_atras),
          jsonb_build_object(
            'nombre', p_nombre, 'apellido', p_apellido, 'documento', p_dni, 'telefono', p_tel,
            'email', lower(p_nombre) || '.' || lower(p_apellido) || '@prueba.com',
            'es_responsable_financiero', p_responsable, 'grupo_id', p_grupo,
            'porcentaje_pago', 30, 'metodo_pago', 'transferencia',
            'cuotas', CASE WHEN p_cuotas > 1 THEN p_cuotas END, 'recargo', CASE WHEN p_cuotas > 1 THEN 10 ELSE 0 END,
            'lugar_embarque', (SELECT jsonb_build_object('id', id, 'nombre', nombre, 'direccion', direccion, 'ciudad', ciudad)
                               FROM lugares_embarque WHERE id = p_embarque),
            'prueba', true))
  RETURNING id INTO v_id;

  UPDATE mapa_asientos_viaje
  SET estado = CASE p_estado WHEN 'aprobado' THEN 'confirmado'::estado_asiento
                             WHEN 'rechazado' THEN 'libre'::estado_asiento
                             ELSE 'bloqueado'::estado_asiento END,
      vendedor_bloqueo_id = CASE WHEN p_estado IN ('pendiente_comprobante', 'pendiente_validacion') THEN c.vendedor_id END,
      bloqueado_hasta = CASE WHEN p_estado IN ('pendiente_comprobante', 'pendiente_validacion') THEN now() + interval '24 hours' END
  WHERE id = v_asiento;
  RETURN v_id;
END $$;

-- p_estados: estado de la seña y de cada cuota. 'informada' = pendiente con comprobante; 'rechazada:<motivo>' = pendiente con motivo.
CREATE FUNCTION pg_temp.pagos(p_reserva INT, p_estados TEXT[])
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  c prueba_ctx;
  v_cuotas INT := array_length(p_estados, 1) - 1;
  v_estado TEXT;
  i INT;
BEGIN
  SELECT * INTO c FROM prueba_ctx;
  FOR i IN 1..array_length(p_estados, 1) LOOP
    v_estado := p_estados[i];
    INSERT INTO pagos_movimientos (reserva_id, tipo, cuota_numero, cuotas_totales, monto, metodo_pago, estado_pago, comprobante_url, motivo_rechazo)
    VALUES (p_reserva,
            CASE WHEN i = 1 THEN 'seña' ELSE 'cuota' END,
            CASE WHEN i > 1 THEN i - 1 END,
            CASE WHEN i > 1 THEN v_cuotas END,
            CASE WHEN i = 1 THEN 30000 WHEN v_cuotas = 1 THEN 70000 ELSE 25667 END,
            'transferencia',
            CASE WHEN v_estado IN ('confirmado', 'rechazado') THEN v_estado ELSE 'pendiente' END,
            CASE WHEN v_estado = 'informada' THEN c.comprobante END,
            CASE WHEN v_estado LIKE 'rechazada:%' THEN substr(v_estado, 11) END);
  END LOOP;

  UPDATE reservas r
  SET monto_pagado = s.pagado,
      estado_financiero = CASE WHEN s.pagado = 0 THEN 'pendiente'
                               WHEN s.pagado >= CASE WHEN v_cuotas > 1 THEN 107000 ELSE 100000 END THEN 'pagado_total'
                               ELSE 'pagado_parcial' END
  FROM (SELECT COALESCE(sum(monto) FILTER (WHERE estado_pago = 'confirmado'), 0) AS pagado
        FROM pagos_movimientos WHERE reserva_id = p_reserva) s
  WHERE r.id = p_reserva;
END $$;

DO $$
DECLARE
  r INT;
  v_vendedor UUID := (SELECT vendedor_id FROM prueba_ctx);
BEGIN
  -- 1. Falta subir el comprobante de la seña (requiere acción)
  r := pg_temp.reserva(1, 'Lucía', 'Fernández', '30111222', '343 411-1111', 'pendiente_comprobante', 'prueba-01', 3, 3, false, NULL, 0);
  PERFORM pg_temp.pagos(r, ARRAY['pendiente', 'pendiente', 'pendiente', 'pendiente']);

  -- 2. Seña subida, esperando validación del admin
  r := pg_temp.reserva(2, 'Martín', 'Gómez', '30222333', '343 422-2222', 'pendiente_validacion', 'prueba-02', 3, 1, true, NULL, 1);
  PERFORM pg_temp.pagos(r, ARRAY['pendiente', 'pendiente', 'pendiente', 'pendiente']);

  -- 3. Grupo familiar de 2 asientos pagando cuotas: cuota 1 pagada, falta informar la 2 (requiere acción)
  r := pg_temp.reserva(3, 'Carlos', 'Rodríguez', '30333444', '343 433-3333', 'aprobado', 'prueba-03', 3, 3, true, NULL, 30);
  PERFORM pg_temp.pagos(r, ARRAY['confirmado', 'confirmado', 'pendiente', 'pendiente']);
  r := pg_temp.reserva(4, 'Laura', 'Rodríguez', '30333445', '343 433-3334', 'aprobado', 'prueba-03', 3, 3, true, NULL, 30, false);
  PERFORM pg_temp.pagos(r, ARRAY['confirmado', 'confirmado', 'pendiente', 'pendiente']);

  -- 4. Cuota 1 informada, esperando al admin (aparece en Validaciones)
  r := pg_temp.reserva(5, 'Sofía', 'Martínez', '30444555', '343 444-4444', 'aprobado', 'prueba-04', 3, 1, true, NULL, 20);
  PERFORM pg_temp.pagos(r, ARRAY['confirmado', 'informada', 'pendiente', 'pendiente']);

  -- 5. Comprobante de cuota rechazado por el admin, con motivo (requiere acción)
  r := pg_temp.reserva(6, 'Diego', 'López', '30555666', '343 455-5555', 'aprobado', 'prueba-05', 3, 3, true, NULL, 25);
  PERFORM pg_temp.pagos(r, ARRAY['confirmado', 'rechazada:El monto transferido no coincide con la cuota ($20.000 en vez de $25.667)', 'pendiente', 'pendiente']);

  -- 6. Última cuota informada: al aprobarla en Validaciones se genera la comisión de $10.700
  r := pg_temp.reserva(7, 'Valentina', 'Sosa', '30666777', '343 466-6666', 'aprobado', 'prueba-06', 3, 1, true, NULL, 60);
  PERFORM pg_temp.pagos(r, ARRAY['confirmado', 'confirmado', 'confirmado', 'informada']);

  -- 7. Pagada al 100%, comisión generada y pendiente de pago por la agencia
  r := pg_temp.reserva(8, 'Julián', 'Pérez', '30777888', '343 477-7777', 'aprobado', 'prueba-07', 3, 3, true, NULL, 90);
  PERFORM pg_temp.pagos(r, ARRAY['confirmado', 'confirmado', 'confirmado', 'confirmado']);
  INSERT INTO comisiones (reserva_id, pago_id, vendedor_id, monto_base, porcentaje, monto_comision, estado)
  SELECT r, max(id), v_vendedor, 107000, 10, 10700, 'pendiente' FROM pagos_movimientos WHERE reserva_id = r;

  -- 8. Pagada al 100% y comisión ya cobrada
  r := pg_temp.reserva(9, 'Camila', 'Torres', '30888999', '343 488-8888', 'aprobado', 'prueba-08', 3, 1, true, NULL, 120);
  PERFORM pg_temp.pagos(r, ARRAY['confirmado', 'confirmado', 'confirmado', 'confirmado']);
  INSERT INTO comisiones (reserva_id, pago_id, vendedor_id, monto_base, porcentaje, monto_comision, estado, pagado_at)
  SELECT r, max(id), v_vendedor, 107000, 10, 10700, 'pagado', now() - interval '10 days' FROM pagos_movimientos WHERE reserva_id = r;

  -- 9. Saldo en una sola cuota de $70.000, sin informar (requiere acción)
  r := pg_temp.reserva(10, 'Pedro', 'Ruiz', '30999000', '343 499-9999', 'aprobado', 'prueba-09', 1, 3, true, NULL, 15);
  PERFORM pg_temp.pagos(r, ARRAY['confirmado', 'pendiente']);

  -- 10. Reserva rechazada por comprobante de seña inválido
  r := pg_temp.reserva(11, 'Ana', 'Benítez', '31000111', '343 400-0000', 'rechazado', 'prueba-10', 3, 1, true, 'Comprobante ilegible, no se ve el número de operación', 5);
  PERFORM pg_temp.pagos(r, ARRAY['rechazado', 'pendiente', 'pendiente', 'pendiente']);
END $$;

-- Resumen de lo cargado
SELECT r.id, r.pasajero_datos->>'nombre' || ' ' || (r.pasajero_datos->>'apellido') AS cliente, r.estado, r.estado_financiero, r.monto_pagado
FROM reservas r WHERE r.viaje_id = (SELECT viaje_id FROM prueba_ctx) ORDER BY r.id;

COMMIT;
